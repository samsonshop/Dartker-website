'use client';

import { cn } from '@/lib/utils';
import { TableSkeleton } from './Skeleton';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  /** Rendered cell. */
  cell: (row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  /** Hide below the given breakpoint on small screens. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
  align?: 'left' | 'right' | 'center';
}

const hideMap = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

const alignMap = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  onRowClick,
  footer,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onRowClick?: (row: T) => void;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-taupe-100 bg-white', className)}>
      {loading ? (
        <TableSkeleton rows={6} cols={Math.min(columns.length, 6)} />
      ) : rows.length === 0 ? (
        <div className="p-5">
          <EmptyState
            compact
            title={emptyTitle}
            description={emptyDescription}
            action={emptyAction}
            className="border-none bg-transparent"
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-taupe-100 bg-ivory-50">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      'px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-charcoal-400',
                      alignMap[column.align ?? 'left'],
                      column.hideBelow && hideMap[column.hideBelow],
                      column.headerClassName,
                    )}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={rowKey(row, index)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-taupe-50 last:border-0 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-ivory-50',
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-4 py-3 align-middle text-charcoal-600',
                        alignMap[column.align ?? 'left'],
                        column.hideBelow && hideMap[column.hideBelow],
                        column.className,
                      )}
                    >
                      {column.cell(row, index)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {footer}
    </div>
  );
}
