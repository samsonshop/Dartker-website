import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { AdminSearchInput, AdminSelect, AdminTabs } from '@/components/admin/AdminFilters';
import { ProductTable } from '@/components/admin/ProductTable';
import { requireAdmin } from '@/lib/auth/guards';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import { getAdminCategories, getProductStats, listAdminProducts } from '@/server/admin/products';
import { firstParam } from '@/lib/utils';
import type { ProductStatusValue } from '@/db/schema';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireAdmin(PERMISSIONS.PRODUCTS_VIEW);
  const params = await searchParams;

  const statusParam = firstParam(params.status);
  const status = (['ACTIVE', 'DRAFT', 'ARCHIVED'] as const).includes(statusParam as ProductStatusValue)
    ? (statusParam as ProductStatusValue)
    : 'ALL';

  const [categories, stats, page] = await Promise.all([
    getAdminCategories(),
    getProductStats(),
    listAdminProducts({
      search: firstParam(params.q),
      categoryId: firstParam(params.category),
      status,
      stockFilter: (firstParam(params.stock) as 'in' | 'low' | 'out' | undefined) ?? 'all',
      sort: (firstParam(params.sort) as 'newest' | undefined) ?? 'newest',
      page: Number(firstParam(params.page)) || 1,
      perPage: 10,
    }),
  ]);

  const canManage = hasPermission(session.permissions, PERMISSIONS.PRODUCTS_MANAGE);

  return (
    <>
      <PageHeader
        title="Products"
        description={`${stats.total} products · ${stats.active} active · ${stats.draft} draft · ${stats.archived} archived`}
        actions={
          canManage ? (
            <ButtonLink href="/admin/products/new">
              <Plus className="h-4 w-4" />
              Add Product
            </ButtonLink>
          ) : null
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <AdminTabs
          paramName="status"
          options={[
            { value: 'ALL', label: 'All', count: stats.total },
            { value: 'ACTIVE', label: 'Active', count: stats.active },
            { value: 'DRAFT', label: 'Draft', count: stats.draft },
            { value: 'ARCHIVED', label: 'Archived', count: stats.archived },
          ]}
        />

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <AdminSearchInput placeholder="Search products or SKU…" className="lg:col-span-2" />
          <AdminSelect
            paramName="category"
            label="Category"
            allLabel="All categories"
            options={categories.map((category) => ({ value: category.id, label: category.name }))}
          />
          <AdminSelect
            paramName="sort"
            label="Sort"
            allLabel="Newest first"
            options={[
              { value: 'name-asc', label: 'Name A–Z' },
              { value: 'price-asc', label: 'Price: low to high' },
              { value: 'price-desc', label: 'Price: high to low' },
              { value: 'stock-asc', label: 'Stock: low to high' },
              { value: 'sold-desc', label: 'Best selling' },
            ]}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-taupe-100 bg-white">
        <ProductTable
          rows={page.items}
          page={page.page}
          totalPages={page.totalPages}
          total={page.total}
          perPage={page.perPage}
          canManage={canManage}
        />
      </div>
    </>
  );
}
