import { AlertTriangle, Boxes, PackageX, Warehouse } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatTile } from '@/components/admin/StatTile';
import { AdminSearchInput, AdminSelect, AdminTabs } from '@/components/admin/AdminFilters';
import { InventoryTable } from '@/components/admin/InventoryTable';
import { requireAdmin } from '@/lib/auth/guards';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import { getAdminCategories, listInventory } from '@/server/admin/products';
import { getInventorySummary } from '@/server/analytics';
import { getStoreSettings } from '@/server/settings';
import { formatPaiseCompact } from '@/lib/money';
import { firstParam, formatNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdmin(PERMISSIONS.INVENTORY_VIEW);
  const params = await searchParams;
  const settings = await getStoreSettings();

  const [summary, categories, page] = await Promise.all([
    getInventorySummary(settings.lowStockThreshold),
    getAdminCategories(),
    listInventory({
      search: firstParam(params.q),
      categoryId: firstParam(params.category),
      stockFilter: (firstParam(params.stock) as 'in' | 'low' | 'out' | undefined) ?? 'all',
      page: Number(firstParam(params.page)) || 1,
      perPage: 12,
    }),
  ]);

  const canManage = hasPermission(session.permissions, PERMISSIONS.INVENTORY_MANAGE);

  return (
    <>
      <PageHeader
        title="Inventory"
        description={`${formatNumber(summary.totalUnits)} units on hand · ${formatPaiseCompact(
          summary.stockValuePaise,
        )} at retail value`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total Products" value={formatNumber(summary.totalProducts)} Icon={Boxes} hint="Excludes archived" />
        <StatTile label="In Stock" value={formatNumber(summary.inStock)} Icon={Warehouse} hint="Above the low-stock threshold" />
        <StatTile label="Low Stock" value={formatNumber(summary.lowStock)} Icon={AlertTriangle} hint="Needs restocking soon" />
        <StatTile label="Out of Stock" value={formatNumber(summary.outOfStock)} Icon={PackageX} hint="Hidden from the storefront" />
      </div>

      <div className="mb-4 mt-5 flex flex-col gap-3">
        <AdminTabs
          paramName="stock"
          options={[
            { value: 'all', label: 'All stock' },
            { value: 'in', label: 'In stock' },
            { value: 'low', label: 'Low stock' },
            { value: 'out', label: 'Out of stock' },
          ]}
        />
        <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
          <AdminSearchInput placeholder="Search product or SKU…" />
          <AdminSelect
            paramName="category"
            label="Category"
            allLabel="All categories"
            options={categories.map((category) => ({ value: category.id, label: category.name }))}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-taupe-100 bg-white">
        <InventoryTable
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
