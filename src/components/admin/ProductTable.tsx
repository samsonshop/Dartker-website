'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Archive, Eye, MoreVertical, Pencil, Trash2, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { AdminPagination } from './AdminFilters';
import { deleteProductAction, setProductStatusAction } from '@/server/actions/admin-products';
import { formatPaiseShort } from '@/lib/money';
import { cn, formatDate } from '@/lib/utils';
import type { AdminProductRow } from '@/server/admin/products';

const STATUS_TONE = {
  ACTIVE: 'success',
  DRAFT: 'warning',
  ARCHIVED: 'neutral',
} as const;

function stockBadge(row: AdminProductRow) {
  if (row.stock <= 0) return <Badge tone="danger">Out of Stock</Badge>;
  if (row.stock <= row.lowStockThreshold) return <Badge tone="warning">Low Stock</Badge>;
  return <Badge tone="success">In Stock</Badge>;
}

export function ProductTable({
  rows,
  page,
  totalPages,
  total,
  perPage,
  canManage,
}: {
  rows: AdminProductRow[];
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
  canManage: boolean;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminProductRow | null>(null);

  function runStatus(row: AdminProductRow, status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED') {
    setMenuFor(null);
    startTransition(async () => {
      const result = await setProductStatusAction(row.id, status);
      toast({
        title: result.ok ? 'Updated' : 'Could not update',
        description: result.message ?? result.error,
        tone: result.ok ? 'success' : 'error',
      });
    });
  }

  function runDelete() {
    if (!confirmDelete) return;
    const row = confirmDelete;
    startTransition(async () => {
      const result = await deleteProductAction(row.id);
      setConfirmDelete(null);
      toast({
        title: result.ok ? 'Done' : 'Could not delete',
        description: result.message ?? result.error,
        tone: result.ok ? 'success' : 'error',
      });
    });
  }

  if (rows.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          compact
          title="No products match these filters"
          description="Try clearing the search or switching the status tab."
        />
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-taupe-100 bg-ivory-50 text-[11px] uppercase tracking-wide text-charcoal-400">
              <th scope="col" className="px-4 py-2.5 text-left font-semibold">Image</th>
              <th scope="col" className="px-4 py-2.5 text-left font-semibold">Name</th>
              <th scope="col" className="px-4 py-2.5 text-left font-semibold">SKU</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">Price</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">Stock</th>
              <th scope="col" className="px-4 py-2.5 text-left font-semibold">Status</th>
              <th scope="col" className="px-4 py-2.5 text-left font-semibold">Updated</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-taupe-50 last:border-0 hover:bg-ivory-50/60">
                <td className="px-4 py-2.5">
                  <div className="relative h-11 w-11 overflow-hidden rounded-lg bg-ivory-200">
                    {row.imageUrl ? (
                      <Image src={row.imageUrl} alt="" fill sizes="44px" className="object-cover" />
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <Link
                    href={`/admin/products/${row.id}`}
                    className="font-medium text-charcoal-700 hover:text-wine-700"
                  >
                    {row.name}
                  </Link>
                  <p className="text-xs text-charcoal-300">
                    {row.categoryName} · {row.variantCount} variant{row.variantCount === 1 ? '' : 's'}
                  </p>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-charcoal-500">{row.sku}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-charcoal-700">
                  {formatPaiseShort(row.pricePaise)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-charcoal-700">{row.stock}</td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {stockBadge(row)}
                    <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs text-charcoal-400">{formatDate(row.updatedAt)}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/product/${row.slug}`}
                      target="_blank"
                      aria-label={`View ${row.name} on the storefront`}
                      className="rounded-lg p-2 text-charcoal-400 hover:bg-white hover:text-wine-700"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    {canManage ? (
                      <>
                        <Link
                          href={`/admin/products/${row.id}`}
                          aria-label={`Edit ${row.name}`}
                          className="rounded-lg p-2 text-charcoal-400 hover:bg-white hover:text-wine-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setMenuFor(menuFor === row.id ? null : row.id)}
                            aria-label={`More actions for ${row.name}`}
                            aria-expanded={menuFor === row.id}
                            className="rounded-lg p-2 text-charcoal-400 hover:bg-white hover:text-charcoal-700"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {menuFor === row.id ? (
                            <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded-xl border border-taupe-100 bg-white p-1.5 shadow-popover">
                              {row.status !== 'ACTIVE' ? (
                                <button
                                  type="button"
                                  onClick={() => runStatus(row, 'ACTIVE')}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-charcoal-600 hover:bg-ivory-50"
                                >
                                  <Undo2 className="h-3.5 w-3.5" />
                                  Publish
                                </button>
                              ) : null}
                              {row.status !== 'DRAFT' ? (
                                <button
                                  type="button"
                                  onClick={() => runStatus(row, 'DRAFT')}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-charcoal-600 hover:bg-ivory-50"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Move to draft
                                </button>
                              ) : null}
                              {row.status !== 'ARCHIVED' ? (
                                <button
                                  type="button"
                                  onClick={() => runStatus(row, 'ARCHIVED')}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-charcoal-600 hover:bg-ivory-50"
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                  Archive
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuFor(null);
                                  setConfirmDelete(row);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-danger-600 hover:bg-danger-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminPagination page={page} totalPages={totalPages} total={total} perPage={perPage} />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={runDelete}
        loading={pending}
        destructive
        title="Delete this product?"
        message={`“${confirmDelete?.name ?? ''}” will be removed. If it appears in past orders it will be archived instead, so order history stays intact.`}
        confirmLabel="Delete"
      />

      <div className={cn('pointer-events-none', pending && 'opacity-70')} aria-hidden="true" />
    </>
  );
}
