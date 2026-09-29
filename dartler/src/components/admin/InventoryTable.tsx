'use client';

import { useActionState, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PackagePlus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { AdminPagination } from './AdminFilters';
import { adjustStockAction, type ActionState } from '@/server/actions/admin-products';
import { formatPaiseShort } from '@/lib/money';
import type { InventoryRowView } from '@/server/admin/products';

const initial: ActionState = { ok: false };

export function InventoryTable({
  rows,
  page,
  totalPages,
  total,
  perPage,
  canManage,
}: {
  rows: InventoryRowView[];
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
  canManage: boolean;
}) {
  const { toast } = useToast();
  const [adjusting, setAdjusting] = useState<InventoryRowView | null>(null);
  const [state, formAction, pending] = useActionState(adjustStockAction, initial);

  useEffect(() => {
    if (state.ok) {
      toast({ title: 'Stock updated', description: state.message, tone: 'success' });
      setAdjusting(null);
    } else if (state.error) {
      toast({ title: 'Could not adjust stock', description: state.error, tone: 'error' });
    }
  }, [state, toast]);

  if (rows.length === 0) {
    return (
      <div className="p-6">
        <EmptyState compact title="No stock rows match these filters" />
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-taupe-100 bg-ivory-50 text-[11px] uppercase tracking-wide text-charcoal-400">
              <th scope="col" className="px-4 py-2.5 text-left font-semibold">Product</th>
              <th scope="col" className="px-4 py-2.5 text-left font-semibold">Variant</th>
              <th scope="col" className="px-4 py-2.5 text-left font-semibold">SKU</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">Stock</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">Low at</th>
              <th scope="col" className="px-4 py-2.5 text-left font-semibold">Status</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">Value</th>
              {canManage ? (
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const state =
                row.quantity <= 0
                  ? { tone: 'danger' as const, label: 'Out of stock' }
                  : row.quantity <= row.lowStockThreshold
                    ? { tone: 'warning' as const, label: 'Low stock' }
                    : { tone: 'success' as const, label: 'In stock' };

              return (
                <tr
                  key={row.variantId}
                  className="border-b border-taupe-50 last:border-0 hover:bg-ivory-50/60"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-ivory-200">
                        {row.imageUrl ? (
                          <Image src={row.imageUrl} alt="" fill sizes="40px" className="object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/admin/products/${row.productId}`}
                          className="block truncate font-medium text-charcoal-700 hover:text-wine-700"
                        >
                          {row.productName}
                        </Link>
                        <p className="text-xs text-charcoal-300">{row.categoryName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-charcoal-600">{row.variantLabel ?? '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-charcoal-500">{row.sku}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-charcoal-700">
                    {row.quantity}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-charcoal-400">
                    {row.lowStockThreshold}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={state.tone}>{state.label}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-charcoal-600">
                    {formatPaiseShort(row.quantity * row.pricePaise)}
                  </td>
                  {canManage ? (
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setAdjusting(row)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-taupe-200 px-2.5 py-1.5 text-xs font-medium text-charcoal-600 hover:border-wine-300 hover:text-wine-700"
                      >
                        <PackagePlus className="h-3.5 w-3.5" />
                        Adjust
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AdminPagination page={page} totalPages={totalPages} total={total} perPage={perPage} />

      <Modal
        open={Boolean(adjusting)}
        onClose={() => setAdjusting(null)}
        title="Adjust stock"
        description={adjusting ? `${adjusting.productName} · ${adjusting.sku}` : undefined}
      >
        {adjusting ? (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="variantId" value={adjusting.variantId} />

            <p className="rounded-xl bg-ivory-50 px-3.5 py-2.5 text-[13px] text-charcoal-500">
              Current stock: <span className="font-medium text-charcoal-700">{adjusting.quantity}</span>
            </p>

            <Select label="Adjustment" name="mode" defaultValue="add" required>
              <option value="add">Add stock</option>
              <option value="remove">Remove stock</option>
              <option value="set">Set exact quantity</option>
            </Select>

            <Input
              label="Quantity"
              name="amount"
              inputMode="numeric"
              required
              defaultValue="1"
              hint="Stock can never go below zero."
            />

            <Select label="Reason" name="reason" defaultValue="PURCHASE" required>
              <option value="PURCHASE">New purchase / restock</option>
              <option value="RETURN">Customer return</option>
              <option value="DAMAGE">Damaged or lost</option>
              <option value="CORRECTION">Stock count correction</option>
            </Select>

            <Textarea label="Note (optional)" name="note" maxLength={200} className="min-h-[70px]" />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAdjusting(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                Save adjustment
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
