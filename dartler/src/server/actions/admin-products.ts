'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import * as t from '@/db/schema';
import { requireAdminApi, ApiError } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { recordAudit } from '@/lib/audit';
import { rupeesToPaise } from '@/lib/money';
import { slugify } from '@/lib/utils';
import { isSkuTaken, isSlugTaken } from '@/server/admin/products';
import { storeProductImage, UploadError } from '@/server/storage';

export interface ActionState {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  productId?: string;
}

const variantSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  color: z.string().trim().max(40).optional().nullable(),
  colorHex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #8E2F45')
    .optional()
    .nullable(),
  size: z.string().trim().max(20).optional().nullable(),
  sku: z.string().trim().min(2).max(60),
  quantity: z.number().int().min(0).max(1_000_000),
  lowStockThreshold: z.number().int().min(0).max(10_000),
  pricePaise: z.number().int().min(0).nullable(),
});

const productSchema = z.object({
  name: z.string().trim().min(2, 'Enter a product name').max(120),
  slug: z.string().trim().max(120).optional(),
  sku: z.string().trim().min(2, 'Enter an SKU').max(60),
  categoryId: z.string().uuid('Select a category'),
  shortDescription: z.string().trim().max(300).optional().nullable(),
  description: z.string().trim().max(8000).default(''),
  pricePaise: z.number().int().min(0, 'Enter a price'),
  compareAtPaise: z.number().int().min(0).nullable(),
  costPaise: z.number().int().min(0).nullable(),
  taxBps: z.number().int().min(0).max(5000),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
  isFeatured: z.boolean(),
  weightGrams: z.number().int().min(0).max(100_000),
  hsnCode: z.string().trim().max(12).optional().nullable(),
  metaTitle: z.string().trim().max(120).optional().nullable(),
  metaDescription: z.string().trim().max(300).optional().nullable(),
  specifications: z.array(z.object({ label: z.string().max(60), value: z.string().max(200) })),
  images: z.array(z.object({ url: z.string().max(400), alt: z.string().max(160) })),
  variants: z.array(variantSchema).min(1, 'Add at least one variant'),
});

export type ProductFormInput = z.input<typeof productSchema>;

function fieldErrors(error: z.ZodError): Record<string, string> {
  const output: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (!output[key]) output[key] = issue.message;
  }
  return output;
}

function parseNumberField(value: FormDataEntryValue | null): number | null {
  if (value === null || String(value).trim() === '') return null;
  const paise = rupeesToPaise(String(value));
  return Number.isNaN(paise) ? null : paise;
}

/** Reads the product form (used by both create and update). */
function readForm(formData: FormData): ProductFormInput {
  const specifications = JSON.parse(String(formData.get('specifications') ?? '[]')) as {
    label: string;
    value: string;
  }[];
  const images = JSON.parse(String(formData.get('images') ?? '[]')) as {
    url: string;
    alt: string;
  }[];
  const variants = JSON.parse(String(formData.get('variants') ?? '[]')) as ProductFormInput['variants'];

  return {
    name: String(formData.get('name') ?? ''),
    slug: String(formData.get('slug') ?? ''),
    sku: String(formData.get('sku') ?? ''),
    categoryId: String(formData.get('categoryId') ?? ''),
    shortDescription: String(formData.get('shortDescription') ?? '') || null,
    description: String(formData.get('description') ?? ''),
    pricePaise: parseNumberField(formData.get('price')) ?? Number.NaN,
    compareAtPaise: parseNumberField(formData.get('compareAt')),
    costPaise: parseNumberField(formData.get('cost')),
    taxBps: Math.round(Number(formData.get('taxPercent') ?? 18) * 100),
    status: (String(formData.get('status') ?? 'DRAFT') as 'DRAFT' | 'ACTIVE' | 'ARCHIVED'),
    isFeatured: formData.get('isFeatured') === 'on' || formData.get('isFeatured') === 'true',
    weightGrams: Number(formData.get('weightGrams') ?? 200),
    hsnCode: String(formData.get('hsnCode') ?? '') || null,
    metaTitle: String(formData.get('metaTitle') ?? '') || null,
    metaDescription: String(formData.get('metaDescription') ?? '') || null,
    specifications,
    images,
    variants,
  };
}

export async function saveProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let session;
  try {
    session = await requireAdminApi(PERMISSIONS.PRODUCTS_MANAGE);
  } catch (error) {
    return { ok: false, error: error instanceof ApiError ? error.message : 'Not authorised.' };
  }

  const productId = String(formData.get('productId') ?? '') || null;
  let parsed;
  try {
    parsed = productSchema.safeParse(readForm(formData));
  } catch {
    return { ok: false, error: 'The form could not be read. Please reload and try again.' };
  }

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const input = parsed.data;
  const slug = slugify(input.slug?.trim() || input.name);

  if (await isSlugTaken(slug, productId ?? undefined)) {
    return { ok: false, error: 'That URL slug is already in use.', fieldErrors: { slug: 'Already used' } };
  }
  if (await isSkuTaken(input.sku, productId ?? undefined)) {
    return { ok: false, error: 'That SKU is already in use.', fieldErrors: { sku: 'Already used' } };
  }

  const variantSkus = input.variants.map((variant) => variant.sku.trim());
  if (new Set(variantSkus).size !== variantSkus.length) {
    return { ok: false, error: 'Each variant needs a unique SKU.' };
  }

  try {
    const savedId = await db.transaction(async (tx) => {
      const base = {
        name: input.name,
        slug,
        sku: input.sku,
        categoryId: input.categoryId,
        shortDescription: input.shortDescription ?? null,
        description: input.description,
        specifications: input.specifications,
        pricePaise: input.pricePaise,
        compareAtPaise: input.compareAtPaise,
        costPaise: input.costPaise,
        taxBps: input.taxBps,
        status: input.status,
        isFeatured: input.isFeatured,
        weightGrams: input.weightGrams,
        hsnCode: input.hsnCode ?? null,
        metaTitle: input.metaTitle ?? null,
        metaDescription: input.metaDescription ?? null,
        publishedAt: input.status === 'ACTIVE' ? new Date() : null,
        updatedAt: new Date(),
      };

      let id = productId;
      if (id) {
        await tx.update(t.products).set(base).where(eq(t.products.id, id));
      } else {
        const [row] = await tx.insert(t.products).values(base).returning({ id: t.products.id });
        id = row.id;
      }

      // Images: replace wholesale — the form always sends the full ordered list.
      await tx.delete(t.productImages).where(eq(t.productImages.productId, id));
      if (input.images.length > 0) {
        await tx.insert(t.productImages).values(
          input.images.map((image, index) => ({
            productId: id!,
            url: image.url,
            alt: image.alt || input.name,
            position: index,
            isPrimary: index === 0,
          })),
        );
      }

      // Variants: update in place, insert new, remove the ones the form dropped.
      const keptIds: string[] = [];
      for (const [index, variant] of input.variants.entries()) {
        const variantValues = {
          productId: id,
          sku: variant.sku.trim(),
          color: variant.color?.trim() || null,
          colorHex: variant.colorHex?.trim() || null,
          size: variant.size?.trim() || null,
          pricePaise: variant.pricePaise,
          position: index,
          isActive: true,
          updatedAt: new Date(),
        };

        if (variant.id) {
          await tx.update(t.productVariants).set(variantValues).where(eq(t.productVariants.id, variant.id));
          keptIds.push(variant.id);

          const existing = await tx.query.inventory.findFirst({
            where: eq(t.inventory.variantId, variant.id),
          });
          if (existing) {
            if (existing.quantity !== variant.quantity) {
              await tx.insert(t.stockMovements).values({
                productId: id,
                variantId: variant.id,
                delta: variant.quantity - existing.quantity,
                balance: variant.quantity,
                reason: 'CORRECTION',
                note: 'Adjusted from the product editor',
                actorType: 'ADMIN',
                actorId: session.user.id,
                actorName: session.user.fullName,
              });
            }
            await tx
              .update(t.inventory)
              .set({
                quantity: variant.quantity,
                lowStockThreshold: variant.lowStockThreshold,
                updatedAt: new Date(),
              })
              .where(eq(t.inventory.id, existing.id));
          } else {
            await tx.insert(t.inventory).values({
              productId: id,
              variantId: variant.id,
              quantity: variant.quantity,
              lowStockThreshold: variant.lowStockThreshold,
            });
          }
        } else {
          const [created] = await tx
            .insert(t.productVariants)
            .values(variantValues)
            .returning({ id: t.productVariants.id });
          keptIds.push(created.id);
          await tx.insert(t.inventory).values({
            productId: id,
            variantId: created.id,
            quantity: variant.quantity,
            lowStockThreshold: variant.lowStockThreshold,
          });
          await tx.insert(t.stockMovements).values({
            productId: id,
            variantId: created.id,
            delta: variant.quantity,
            balance: variant.quantity,
            reason: 'INITIAL',
            note: 'Opening stock',
            actorType: 'ADMIN',
            actorId: session.user.id,
            actorName: session.user.fullName,
          });
        }
      }

      const removable = await tx.query.productVariants.findMany({
        where: eq(t.productVariants.productId, id),
        columns: { id: true },
      });
      const toRemove = removable.map((row) => row.id).filter((value) => !keptIds.includes(value));
      if (toRemove.length > 0) {
        // Variants referenced by an order are deactivated, never deleted, so
        // historical order lines keep resolving.
        const referenced = await tx
          .select({ variantId: t.orderItems.variantId })
          .from(t.orderItems)
          .where(inArray(t.orderItems.variantId, toRemove));
        const referencedIds = new Set(referenced.map((row) => row.variantId));
        const hardDelete = toRemove.filter((value) => !referencedIds.has(value));
        const softDelete = toRemove.filter((value) => referencedIds.has(value));

        if (hardDelete.length) {
          await tx.delete(t.productVariants).where(inArray(t.productVariants.id, hardDelete));
        }
        if (softDelete.length) {
          await tx
            .update(t.productVariants)
            .set({ isActive: false, updatedAt: new Date() })
            .where(inArray(t.productVariants.id, softDelete));
        }
      }

      return id;
    });

    await recordAudit({
      actorId: session.user.id,
      actorName: session.user.fullName,
      action: productId ? 'product.update' : 'product.create',
      entity: 'product',
      entityId: savedId ?? undefined,
      summary: `${productId ? 'Updated' : 'Created'} product “${input.name}”`,
      metadata: { sku: input.sku, status: input.status },
    });

    revalidatePath('/admin/products');
    revalidatePath('/admin/inventory');
    revalidatePath(`/product/${slug}`);

    return {
      ok: true,
      message: productId ? 'Product updated.' : 'Product created.',
      productId: savedId ?? undefined,
    };
  } catch (error) {
    console.error('[saveProduct]', error);
    return { ok: false, error: 'Could not save the product. Please try again.' };
  }
}

export async function setProductStatusAction(
  productId: string,
  status: t.ProductStatusValue,
): Promise<ActionState> {
  try {
    const session = await requireAdminApi(PERMISSIONS.PRODUCTS_MANAGE);
    const product = await db.query.products.findFirst({
      where: eq(t.products.id, productId),
      columns: { id: true, name: true, slug: true },
    });
    if (!product) return { ok: false, error: 'Product not found.' };

    await db
      .update(t.products)
      .set({ status, updatedAt: new Date() })
      .where(eq(t.products.id, productId));

    await recordAudit({
      actorId: session.user.id,
      actorName: session.user.fullName,
      action: 'product.status',
      entity: 'product',
      entityId: productId,
      summary: `Set “${product.name}” to ${status}`,
    });

    revalidatePath('/admin/products');
    revalidatePath(`/product/${product.slug}`);
    return { ok: true, message: `Product moved to ${status.toLowerCase()}.` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof ApiError ? error.message : 'Could not update the product.',
    };
  }
}

export async function deleteProductAction(productId: string): Promise<ActionState> {
  try {
    const session = await requireAdminApi(PERMISSIONS.PRODUCTS_MANAGE);

    const [sold] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(t.orderItems)
      .where(eq(t.orderItems.productId, productId));

    if (Number(sold?.value ?? 0) > 0) {
      // Deleting would orphan order history, so archiving is the safe equivalent.
      await db
        .update(t.products)
        .set({ status: 'ARCHIVED', updatedAt: new Date() })
        .where(eq(t.products.id, productId));
      await recordAudit({
        actorId: session.user.id,
        actorName: session.user.fullName,
        action: 'product.archive',
        entity: 'product',
        entityId: productId,
        summary: 'Archived instead of deleted — the product appears in past orders',
      });
      revalidatePath('/admin/products');
      return {
        ok: true,
        message: 'This product appears in past orders, so it was archived rather than deleted.',
      };
    }

    await db.delete(t.products).where(eq(t.products.id, productId));
    await recordAudit({
      actorId: session.user.id,
      actorName: session.user.fullName,
      action: 'product.delete',
      entity: 'product',
      entityId: productId,
      summary: 'Deleted product',
    });

    revalidatePath('/admin/products');
    return { ok: true, message: 'Product deleted.' };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof ApiError ? error.message : 'Could not delete the product.',
    };
  }
}

export async function adjustStockAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let session;
  try {
    session = await requireAdminApi(PERMISSIONS.INVENTORY_MANAGE);
  } catch (error) {
    return { ok: false, error: error instanceof ApiError ? error.message : 'Not authorised.' };
  }

  const schema = z.object({
    variantId: z.string().uuid(),
    mode: z.enum(['set', 'add', 'remove']),
    amount: z.coerce.number().int().min(0).max(1_000_000),
    reason: z.enum(['PURCHASE', 'RETURN', 'DAMAGE', 'CORRECTION']),
    note: z.string().trim().max(200).optional(),
  });

  const parsed = schema.safeParse({
    variantId: formData.get('variantId'),
    mode: formData.get('mode'),
    amount: formData.get('amount'),
    reason: formData.get('reason'),
    note: formData.get('note') ?? undefined,
  });

  if (!parsed.success) return { ok: false, error: 'Enter a valid quantity and reason.' };

  const { variantId, mode, amount, reason, note } = parsed.data;

  try {
    const result = await db.transaction(async (tx) => {
      const row = await tx.query.inventory.findFirst({
        where: eq(t.inventory.variantId, variantId),
      });
      if (!row) throw new Error('Inventory row not found');

      const next =
        mode === 'set' ? amount : mode === 'add' ? row.quantity + amount : row.quantity - amount;
      // Stock can never go below zero, whatever the admin types.
      const clamped = Math.max(0, next);

      await tx
        .update(t.inventory)
        .set({ quantity: clamped, updatedAt: new Date() })
        .where(eq(t.inventory.id, row.id));

      await tx.insert(t.stockMovements).values({
        productId: row.productId,
        variantId,
        delta: clamped - row.quantity,
        balance: clamped,
        reason,
        note: note || null,
        actorType: 'ADMIN',
        actorId: session.user.id,
        actorName: session.user.fullName,
      });

      return { previous: row.quantity, next: clamped, productId: row.productId };
    });

    await recordAudit({
      actorId: session.user.id,
      actorName: session.user.fullName,
      action: 'inventory.adjust',
      entity: 'inventory',
      entityId: variantId,
      summary: `Stock ${result.previous} → ${result.next} (${reason})`,
      metadata: { note },
    });

    revalidatePath('/admin/inventory');
    revalidatePath('/admin/products');
    return { ok: true, message: `Stock updated to ${result.next}.` };
  } catch (error) {
    console.error('[adjustStock]', error);
    return { ok: false, error: 'Could not adjust stock.' };
  }
}

export async function setLowStockThresholdAction(
  variantId: string,
  threshold: number,
): Promise<ActionState> {
  try {
    const session = await requireAdminApi(PERMISSIONS.INVENTORY_MANAGE);
    const value = Math.max(0, Math.min(10_000, Math.round(threshold)));
    await db
      .update(t.inventory)
      .set({ lowStockThreshold: value, updatedAt: new Date() })
      .where(eq(t.inventory.variantId, variantId));

    await recordAudit({
      actorId: session.user.id,
      actorName: session.user.fullName,
      action: 'inventory.threshold',
      entity: 'inventory',
      entityId: variantId,
      summary: `Low-stock threshold set to ${value}`,
    });

    revalidatePath('/admin/inventory');
    return { ok: true, message: 'Threshold updated.' };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof ApiError ? error.message : 'Could not update the threshold.',
    };
  }
}

export async function uploadProductImageAction(
  formData: FormData,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    await requireAdminApi(PERMISSIONS.PRODUCTS_MANAGE);
    const file = formData.get('file');
    if (!(file instanceof File)) return { ok: false, error: 'No file received.' };

    const stored = await storeProductImage(file);
    return { ok: true, url: stored.url };
  } catch (error) {
    if (error instanceof UploadError) return { ok: false, error: error.message };
    if (error instanceof ApiError) return { ok: false, error: error.message };
    console.error('[uploadProductImage]', error);
    return { ok: false, error: 'Upload failed. Please try again.' };
  }
}

export async function bulkProductStatusAction(
  productIds: string[],
  status: t.ProductStatusValue,
): Promise<ActionState> {
  try {
    const session = await requireAdminApi(PERMISSIONS.PRODUCTS_MANAGE);
    if (productIds.length === 0) return { ok: false, error: 'Select at least one product.' };

    await db
      .update(t.products)
      .set({ status, updatedAt: new Date() })
      .where(and(inArray(t.products.id, productIds)));

    await recordAudit({
      actorId: session.user.id,
      actorName: session.user.fullName,
      action: 'product.bulk_status',
      entity: 'product',
      summary: `Set ${productIds.length} products to ${status}`,
    });

    revalidatePath('/admin/products');
    return { ok: true, message: `${productIds.length} products updated.` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof ApiError ? error.message : 'Could not update the products.',
    };
  }
}
