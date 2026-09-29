'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  GripVertical,
  ImagePlus,
  Loader2,
  Plus,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import {
  saveProductAction,
  uploadProductImageAction,
  type ActionState,
} from '@/server/actions/admin-products';
import { paiseToRupees, rupeesToPaise } from '@/lib/money';
import { cn, slugify } from '@/lib/utils';

export interface ProductFormValues {
  id?: string;
  name: string;
  slug: string;
  sku: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  price: string;
  compareAt: string;
  cost: string;
  taxPercent: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  isFeatured: boolean;
  weightGrams: string;
  hsnCode: string;
  metaTitle: string;
  metaDescription: string;
  specifications: { label: string; value: string }[];
  images: { url: string; alt: string }[];
  variants: {
    id?: string | null;
    color: string;
    colorHex: string;
    size: string;
    sku: string;
    quantity: number;
    lowStockThreshold: number;
    priceOverride: string;
  }[];
}

export const emptyProduct: ProductFormValues = {
  name: '',
  slug: '',
  sku: '',
  categoryId: '',
  shortDescription: '',
  description: '',
  price: '',
  compareAt: '',
  cost: '',
  taxPercent: '18',
  status: 'DRAFT',
  isFeatured: false,
  weightGrams: '200',
  hsnCode: '',
  metaTitle: '',
  metaDescription: '',
  specifications: [{ label: '', value: '' }],
  images: [],
  variants: [
    { color: '', colorHex: '#D9C4B4', size: '', sku: '', quantity: 0, lowStockThreshold: 10, priceOverride: '' },
  ],
};

const initialState: ActionState = { ok: false };

export function ProductForm({
  categories,
  initial,
}: {
  categories: { id: string; name: string }[];
  initial: ProductFormValues;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState<ProductFormValues>(initial);
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(saveProductAction, initialState);
  const fileInput = useRef<HTMLInputElement>(null);

  const isEdit = Boolean(initial.id);

  function update<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!state.ok) return;
    setDirty(false);
    toast({ title: state.message ?? 'Saved', tone: 'success' });
    if (!isEdit && state.productId) router.push(`/admin/products/${state.productId}`);
    else router.refresh();
  }, [state, isEdit, router, toast]);

  const derivedSlug = useMemo(
    () => values.slug.trim() || slugify(values.name || ''),
    [values.slug, values.name],
  );

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    const added: { url: string; alt: string }[] = [];

    for (const file of Array.from(files).slice(0, 8)) {
      const data = new FormData();
      data.append('file', file);
      const result = await uploadProductImageAction(data);
      if (result.ok && result.url) added.push({ url: result.url, alt: values.name });
      else setUploadError(result.error ?? 'Upload failed.');
    }

    if (added.length) update('images', [...values.images, ...added]);
    setUploading(false);
    if (fileInput.current) fileInput.current.value = '';
  }

  function moveImage(from: number, to: number) {
    if (to < 0 || to >= values.images.length) return;
    const next = [...values.images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    update('images', next);
  }

  const generalTab = (
    <div className="grid gap-4 lg:grid-cols-2">
      <Input
        label="Product name"
        required
        value={values.name}
        onChange={(event) => update('name', event.target.value)}
        error={state.fieldErrors?.name}
        wrapperClassName="lg:col-span-2"
        placeholder="Classic Hair Clutch Clip"
      />
      <Select
        label="Category"
        required
        value={values.categoryId}
        onChange={(event) => update('categoryId', event.target.value)}
        error={state.fieldErrors?.categoryId}
      >
        <option value="">Select category</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>
      <Input
        label="Product SKU"
        required
        value={values.sku}
        onChange={(event) => update('sku', event.target.value.toUpperCase())}
        error={state.fieldErrors?.sku}
        placeholder="HAI-001"
      />
      <Input
        label="Price (₹)"
        required
        inputMode="decimal"
        value={values.price}
        onChange={(event) => update('price', event.target.value)}
        error={state.fieldErrors?.pricePaise}
        placeholder="299"
      />
      <Input
        label="Compare-at price (₹)"
        inputMode="decimal"
        value={values.compareAt}
        onChange={(event) => update('compareAt', event.target.value)}
        hint="Shown struck through to display a discount."
        placeholder="499"
      />
      <Input
        label="Cost price (₹)"
        inputMode="decimal"
        value={values.cost}
        onChange={(event) => update('cost', event.target.value)}
        hint="Internal only — never shown to customers."
      />
      <Input
        label="GST rate (%)"
        inputMode="decimal"
        value={values.taxPercent}
        onChange={(event) => update('taxPercent', event.target.value)}
      />
      <Input
        label="Short description"
        value={values.shortDescription}
        onChange={(event) => update('shortDescription', event.target.value)}
        wrapperClassName="lg:col-span-2"
        maxLength={300}
        placeholder="One line shown under the product name."
      />
      <Textarea
        label="Full description"
        value={values.description}
        onChange={(event) => update('description', event.target.value)}
        wrapperClassName="lg:col-span-2"
        className="min-h-[180px]"
        placeholder="Materials, dimensions, how it wears…"
      />

      <div className="lg:col-span-2">
        <p className="mb-2 text-[13px] font-medium text-charcoal-600">Specifications</p>
        <div className="space-y-2">
          {values.specifications.map((spec, index) => (
            <div key={index} className="flex gap-2">
              <input
                value={spec.label}
                onChange={(event) => {
                  const next = [...values.specifications];
                  next[index] = { ...next[index], label: event.target.value };
                  update('specifications', next);
                }}
                placeholder="Material"
                aria-label={`Specification ${index + 1} label`}
                className="h-10 w-44 rounded-xl border border-taupe-200 px-3 text-sm"
              />
              <input
                value={spec.value}
                onChange={(event) => {
                  const next = [...values.specifications];
                  next[index] = { ...next[index], value: event.target.value };
                  update('specifications', next);
                }}
                placeholder="Acrylic"
                aria-label={`Specification ${index + 1} value`}
                className="h-10 flex-1 rounded-xl border border-taupe-200 px-3 text-sm"
              />
              <button
                type="button"
                onClick={() =>
                  update(
                    'specifications',
                    values.specifications.filter((_, position) => position !== index),
                  )
                }
                aria-label={`Remove specification ${index + 1}`}
                className="rounded-lg p-2 text-charcoal-300 hover:bg-danger-50 hover:text-danger-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => update('specifications', [...values.specifications, { label: '', value: '' }])}
          className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-wine-700 hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          Add specification
        </button>
      </div>
    </div>
  );

  const imagesTab = (
    <div>
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void handleUpload(event.dataTransfer.files);
        }}
        className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-taupe-200 bg-ivory-50 px-6 py-10 text-center"
      >
        <ImagePlus className="h-7 w-7 text-taupe-400" />
        <p className="mt-2 text-sm text-charcoal-600">Click to upload or drag and drop</p>
        <p className="text-xs text-charcoal-300">JPG, PNG, WebP or AVIF, up to 5 MB each</p>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          onChange={(event) => void handleUpload(event.target.files)}
          className="sr-only"
          id="product-images"
        />
        <label
          htmlFor="product-images"
          className="mt-3 inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-taupe-200 bg-white px-4 text-[13px] font-medium text-charcoal-600 hover:border-wine-300"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Choose images
        </label>
        {uploadError ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-danger-600" role="alert">
            <AlertCircle className="h-3.5 w-3.5" />
            {uploadError}
          </p>
        ) : null}
      </div>

      {values.images.length > 0 ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {values.images.map((image, index) => (
            <li
              key={image.url}
              className="group relative overflow-hidden rounded-xl border border-taupe-100 bg-white"
            >
              <div className="relative aspect-square bg-ivory-200">
                <Image src={image.url} alt={image.alt} fill sizes="200px" className="object-cover" />
              </div>
              {index === 0 ? (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-wine-600 px-2 py-0.5 text-[10px] font-medium text-white">
                  <Star className="h-2.5 w-2.5" />
                  Primary
                </span>
              ) : null}
              <div className="flex items-center justify-between gap-1 p-1.5">
                <button
                  type="button"
                  onClick={() => moveImage(index, index - 1)}
                  disabled={index === 0}
                  aria-label="Move image earlier"
                  className="rounded p-1 text-charcoal-300 hover:text-charcoal-700 disabled:opacity-30"
                >
                  <GripVertical className="h-3.5 w-3.5 rotate-90" />
                </button>
                <button
                  type="button"
                  onClick={() => moveImage(index, index + 1)}
                  disabled={index === values.images.length - 1}
                  aria-label="Move image later"
                  className="rounded p-1 text-charcoal-300 hover:text-charcoal-700 disabled:opacity-30"
                >
                  <GripVertical className="h-3.5 w-3.5 -rotate-90" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    update(
                      'images',
                      values.images.filter((_, position) => position !== index),
                    )
                  }
                  aria-label="Remove image"
                  className="ml-auto rounded p-1 text-charcoal-300 hover:text-danger-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-charcoal-400">
          No images yet. The first image becomes the primary one shown in listings.
        </p>
      )}
    </div>
  );

  const variantsTab = (
    <div>
      <p className="mb-3 text-[13px] text-charcoal-400">
        Every product needs at least one variant — stock is tracked per variant, never on the
        product itself.
      </p>

      <div className="space-y-3">
        {values.variants.map((variant, index) => (
          <div key={index} className="rounded-2xl border border-taupe-100 bg-ivory-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <Input
                label="Colour"
                value={variant.color}
                onChange={(event) => {
                  const next = [...values.variants];
                  next[index] = { ...next[index], color: event.target.value };
                  update('variants', next);
                }}
                placeholder="Beige"
              />
              <div>
                <label
                  htmlFor={`variant-hex-${index}`}
                  className="mb-1.5 block text-[13px] font-medium text-charcoal-600"
                >
                  Swatch
                </label>
                <div className="flex gap-2">
                  <input
                    id={`variant-hex-${index}`}
                    type="color"
                    value={variant.colorHex || '#D9C4B4'}
                    onChange={(event) => {
                      const next = [...values.variants];
                      next[index] = { ...next[index], colorHex: event.target.value };
                      update('variants', next);
                    }}
                    className="h-11 w-14 cursor-pointer rounded-xl border border-taupe-200 bg-white p-1"
                  />
                  <input
                    value={variant.colorHex}
                    onChange={(event) => {
                      const next = [...values.variants];
                      next[index] = { ...next[index], colorHex: event.target.value };
                      update('variants', next);
                    }}
                    aria-label={`Variant ${index + 1} hex colour`}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-taupe-200 px-3 font-mono text-xs uppercase"
                  />
                </div>
              </div>
              <Input
                label="Size"
                value={variant.size}
                onChange={(event) => {
                  const next = [...values.variants];
                  next[index] = { ...next[index], size: event.target.value };
                  update('variants', next);
                }}
                placeholder="Standard"
              />
              <Input
                label="Variant SKU"
                required
                value={variant.sku}
                onChange={(event) => {
                  const next = [...values.variants];
                  next[index] = { ...next[index], sku: event.target.value.toUpperCase() };
                  update('variants', next);
                }}
                placeholder="HAI-001-BEIGE"
              />
              <Input
                label="Stock"
                inputMode="numeric"
                value={String(variant.quantity)}
                onChange={(event) => {
                  const next = [...values.variants];
                  next[index] = {
                    ...next[index],
                    quantity: Math.max(0, Number(event.target.value.replace(/\D/g, '')) || 0),
                  };
                  update('variants', next);
                }}
              />
              <Input
                label="Low-stock at"
                inputMode="numeric"
                value={String(variant.lowStockThreshold)}
                onChange={(event) => {
                  const next = [...values.variants];
                  next[index] = {
                    ...next[index],
                    lowStockThreshold: Math.max(0, Number(event.target.value.replace(/\D/g, '')) || 0),
                  };
                  update('variants', next);
                }}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <Input
                label="Price override (₹)"
                inputMode="decimal"
                value={variant.priceOverride}
                onChange={(event) => {
                  const next = [...values.variants];
                  next[index] = { ...next[index], priceOverride: event.target.value };
                  update('variants', next);
                }}
                hint="Leave empty to use the product price."
                wrapperClassName="w-48"
              />
              {values.variants.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    update(
                      'variants',
                      values.variants.filter((_, position) => position !== index),
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] text-danger-600 hover:bg-danger-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove variant
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          update('variants', [
            ...values.variants,
            {
              color: '',
              colorHex: '#D9C4B4',
              size: '',
              sku: `${values.sku || 'SKU'}-${values.variants.length + 1}`,
              quantity: 0,
              lowStockThreshold: 10,
              priceOverride: '',
            },
          ])
        }
        className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-wine-700 hover:underline"
      >
        <Plus className="h-3.5 w-3.5" />
        Add variant
      </button>
    </div>
  );

  const seoTab = (
    <div className="grid max-w-2xl gap-4">
      <Input
        label="URL slug"
        value={values.slug}
        onChange={(event) => update('slug', event.target.value)}
        hint={`Storefront URL: /product/${derivedSlug || 'your-product'}`}
        error={state.fieldErrors?.slug}
        placeholder="classic-hair-clutch-clip"
      />
      <Input
        label="Meta title"
        value={values.metaTitle}
        onChange={(event) => update('metaTitle', event.target.value)}
        maxLength={120}
        hint={`${values.metaTitle.length}/120 characters`}
      />
      <Textarea
        label="Meta description"
        value={values.metaDescription}
        onChange={(event) => update('metaDescription', event.target.value)}
        maxLength={300}
        hint={`${values.metaDescription.length}/300 characters`}
      />
      <Input
        label="HSN code"
        value={values.hsnCode}
        onChange={(event) => update('hsnCode', event.target.value)}
        hint="Used on GST invoices."
        placeholder="9615"
      />
      <Input
        label="Shipping weight (grams)"
        inputMode="numeric"
        value={values.weightGrams}
        onChange={(event) => update('weightGrams', event.target.value.replace(/\D/g, ''))}
        hint="Delhivery uses this to price the shipment."
      />
    </div>
  );

  return (
    <form
      action={formAction}
      onSubmit={() => setDirty(false)}
      className="grid items-start gap-5 lg:grid-cols-[1fr_280px]"
    >
      {/* Complex nested state travels as JSON so the server sees exactly one shape. */}
      <input type="hidden" name="productId" value={values.id ?? ''} />
      <input type="hidden" name="name" value={values.name} />
      <input type="hidden" name="slug" value={values.slug} />
      <input type="hidden" name="sku" value={values.sku} />
      <input type="hidden" name="categoryId" value={values.categoryId} />
      <input type="hidden" name="shortDescription" value={values.shortDescription} />
      <input type="hidden" name="description" value={values.description} />
      <input type="hidden" name="price" value={values.price} />
      <input type="hidden" name="compareAt" value={values.compareAt} />
      <input type="hidden" name="cost" value={values.cost} />
      <input type="hidden" name="taxPercent" value={values.taxPercent} />
      <input type="hidden" name="status" value={values.status} />
      <input type="hidden" name="isFeatured" value={values.isFeatured ? 'true' : 'false'} />
      <input type="hidden" name="weightGrams" value={values.weightGrams} />
      <input type="hidden" name="hsnCode" value={values.hsnCode} />
      <input type="hidden" name="metaTitle" value={values.metaTitle} />
      <input type="hidden" name="metaDescription" value={values.metaDescription} />
      <input
        type="hidden"
        name="specifications"
        value={JSON.stringify(
          values.specifications.filter((spec) => spec.label.trim() && spec.value.trim()),
        )}
      />
      <input type="hidden" name="images" value={JSON.stringify(values.images)} />
      <input
        type="hidden"
        name="variants"
        value={JSON.stringify(
          values.variants.map((variant) => ({
            id: variant.id ?? null,
            color: variant.color || null,
            colorHex: variant.colorHex || null,
            size: variant.size || null,
            sku: variant.sku,
            quantity: variant.quantity,
            lowStockThreshold: variant.lowStockThreshold,
            priceOverride: variant.priceOverride,
            pricePaise: variant.priceOverride.trim()
              ? (Number.isNaN(rupeesToPaise(variant.priceOverride))
                  ? null
                  : rupeesToPaise(variant.priceOverride))
              : null,
          })),
        )}
      />

      <div className="rounded-2xl border border-taupe-100 bg-white p-5">
        {state.error ? (
          <p
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-xl bg-danger-50 px-3.5 py-2.5 text-[13px] text-danger-600"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {state.error}
          </p>
        ) : null}

        <Tabs
          items={[
            { id: 'general', label: 'General', content: generalTab },
            { id: 'images', label: `Images (${values.images.length})`, content: imagesTab },
            { id: 'variants', label: `Variants (${values.variants.length})`, content: variantsTab },
            { id: 'seo', label: 'SEO & shipping', content: seoTab },
          ]}
        />
      </div>

      <aside className="sticky top-24 space-y-4">
        <div className="rounded-2xl border border-taupe-100 bg-white p-5">
          <h2 className="font-serif text-base text-charcoal-700">Publishing</h2>

          <div className="mt-3 space-y-3">
            <Select
              label="Status"
              value={values.status}
              onChange={(event) =>
                update('status', event.target.value as ProductFormValues['status'])
              }
            >
              <option value="DRAFT">Draft — hidden from the store</option>
              <option value="ACTIVE">Active — visible to customers</option>
              <option value="ARCHIVED">Archived — hidden, kept for history</option>
            </Select>

            <Checkbox
              checked={values.isFeatured}
              onChange={(event) => update('isFeatured', event.target.checked)}
              label="Feature on the homepage"
            />
          </div>

          <div className="mt-4 space-y-2">
            <Button type="submit" fullWidth loading={pending}>
              {isEdit ? 'Save changes' : 'Create product'}
            </Button>
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() => router.push('/admin/products')}
            >
              Cancel
            </Button>
          </div>

          {dirty ? (
            <p className="mt-3 text-center text-xs text-warning-600">You have unsaved changes.</p>
          ) : null}
        </div>

        <div className={cn('rounded-2xl border border-taupe-100 bg-white p-5')}>
          <h2 className="font-serif text-base text-charcoal-700">Live preview</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-taupe-100">
            <div className="relative aspect-square bg-ivory-200">
              {values.images[0] ? (
                <Image src={values.images[0].url} alt="" fill sizes="240px" className="object-cover" />
              ) : null}
            </div>
            <div className="p-3">
              <p className="truncate text-sm font-medium text-charcoal-700">
                {values.name || 'Product name'}
              </p>
              <p className="mt-0.5 text-sm text-wine-700">
                {values.price ? `₹${paiseToRupees(rupeesToPaise(values.price)).toLocaleString('en-IN')}` : '₹—'}
              </p>
              <p className="text-xs text-charcoal-300">
                {values.variants.reduce((total, variant) => total + variant.quantity, 0)} in stock
              </p>
            </div>
          </div>
        </div>
      </aside>
    </form>
  );
}
