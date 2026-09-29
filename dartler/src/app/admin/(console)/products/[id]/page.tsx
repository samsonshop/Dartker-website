import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { ProductForm, type ProductFormValues } from '@/components/admin/ProductForm';
import { requireAdmin } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { getAdminCategories, getAdminProduct, getStockHistory } from '@/server/admin/products';
import { paiseToRupees } from '@/lib/money';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function rupeeField(paise: number | null | undefined): string {
  return paise === null || paise === undefined ? '' : String(paiseToRupees(paise));
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin(PERMISSIONS.PRODUCTS_MANAGE);
  const { id } = await params;

  const [product, categories] = await Promise.all([getAdminProduct(id), getAdminCategories()]);
  if (!product) notFound();

  const history = await getStockHistory(product.id, 12);

  const initial: ProductFormValues = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    categoryId: product.categoryId,
    shortDescription: product.shortDescription ?? '',
    description: product.description,
    price: rupeeField(product.pricePaise),
    compareAt: rupeeField(product.compareAtPaise),
    cost: rupeeField(product.costPaise),
    taxPercent: String(product.taxBps / 100),
    status: product.status,
    isFeatured: product.isFeatured,
    weightGrams: String(product.weightGrams),
    hsnCode: product.hsnCode ?? '',
    metaTitle: product.metaTitle ?? '',
    metaDescription: product.metaDescription ?? '',
    specifications:
      product.specifications.length > 0 ? product.specifications : [{ label: '', value: '' }],
    images: product.images.map((image) => ({ url: image.url, alt: image.alt })),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      color: variant.color ?? '',
      colorHex: variant.colorHex ?? '#D9C4B4',
      size: variant.size ?? '',
      sku: variant.sku,
      quantity: variant.inventory?.quantity ?? 0,
      lowStockThreshold: variant.inventory?.lowStockThreshold ?? 10,
      priceOverride: rupeeField(variant.pricePaise),
    })),
  };

  return (
    <>
      <Breadcrumbs
        className="mb-3"
        items={[{ label: 'Products', href: '/admin/products' }, { label: product.name }]}
      />
      <PageHeader
        title={product.name}
        description={`SKU ${product.sku} · ${product.category.name}`}
        actions={
          <Link
            href={`/product/${product.slug}`}
            target="_blank"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-taupe-200 bg-white px-4 text-[13px] font-medium text-charcoal-600 hover:border-wine-300"
          >
            <ExternalLink className="h-4 w-4" />
            View on storefront
          </Link>
        }
      />

      <ProductForm categories={categories} initial={initial} />

      <section className="mt-5 rounded-2xl border border-taupe-100 bg-white">
        <header className="border-b border-taupe-100 px-5 py-3.5">
          <h2 className="font-serif text-base text-charcoal-700">Stock history</h2>
          <p className="text-xs text-charcoal-400">Every change to this product’s stock, with who made it.</p>
        </header>
        {history.length === 0 ? (
          <p className="p-5 text-sm text-charcoal-400">No stock movements recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-taupe-100 bg-ivory-50 text-[11px] uppercase tracking-wide text-charcoal-400">
                  <th scope="col" className="px-5 py-2.5 text-left font-semibold">When</th>
                  <th scope="col" className="px-5 py-2.5 text-left font-semibold">Variant</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-semibold">Change</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-semibold">Balance</th>
                  <th scope="col" className="px-5 py-2.5 text-left font-semibold">Reason</th>
                  <th scope="col" className="px-5 py-2.5 text-left font-semibold">By</th>
                </tr>
              </thead>
              <tbody>
                {history.map((movement) => (
                  <tr key={movement.id} className="border-b border-taupe-50 last:border-0">
                    <td className="px-5 py-2.5 text-xs text-charcoal-400">
                      {formatDateTime(movement.createdAt)}
                    </td>
                    <td className="px-5 py-2.5 font-mono text-xs text-charcoal-500">
                      {movement.variant?.sku ?? '—'}
                    </td>
                    <td
                      className={`px-5 py-2.5 text-right tabular-nums ${
                        movement.delta >= 0 ? 'text-success-600' : 'text-danger-600'
                      }`}
                    >
                      {movement.delta > 0 ? '+' : ''}
                      {movement.delta}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-charcoal-700">
                      {movement.balance}
                    </td>
                    <td className="px-5 py-2.5 text-charcoal-600">
                      {movement.reason.replaceAll('_', ' ').toLowerCase()}
                      {movement.note ? (
                        <span className="block text-xs text-charcoal-300">{movement.note}</span>
                      ) : null}
                    </td>
                    <td className="px-5 py-2.5 text-xs text-charcoal-400">
                      {movement.actorName ?? 'System'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
