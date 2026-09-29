import { PageHeader } from '@/components/admin/PageHeader';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { ProductForm, emptyProduct } from '@/components/admin/ProductForm';
import { requireAdmin } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { getAdminCategories } from '@/server/admin/products';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  await requireAdmin(PERMISSIONS.PRODUCTS_MANAGE);
  const categories = await getAdminCategories();

  return (
    <>
      <Breadcrumbs
        className="mb-3"
        items={[{ label: 'Products', href: '/admin/products' }, { label: 'Add product' }]}
      />
      <PageHeader
        title="Add New Product"
        description="Stock is tracked per variant, so add at least one variant before publishing."
      />
      <ProductForm categories={categories} initial={emptyProduct} />
    </>
  );
}
