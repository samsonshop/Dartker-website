import Image from 'next/image';
import Link from 'next/link';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { formatPaiseShort } from '@/lib/money';
import type { OrderStatus, PaymentStatusValue } from '@/db/schema';

export const ORDER_STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  PENDING: 'warning',
  CONFIRMED: 'info',
  PROCESSING: 'warning',
  SHIPPED: 'info',
  OUT_FOR_DELIVERY: 'info',
  DELIVERED: 'success',
  CANCELLED: 'danger',
  RETURNED: 'neutral',
  FAILED: 'danger',
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
  FAILED: 'Failed',
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatusValue, BadgeTone> = {
  PENDING: 'warning',
  AUTHORIZED: 'info',
  PAID: 'success',
  FAILED: 'danger',
  REFUND_PENDING: 'warning',
  REFUNDED: 'neutral',
  PARTIALLY_REFUNDED: 'neutral',
};

export interface OrderItemView {
  id: string;
  name: string;
  slug: string | null;
  variantLabel: string | null;
  imageUrl: string | null;
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
}

export function OrderItemsList({ items }: { items: OrderItemView[] }) {
  return (
    <ul className="divide-y divide-taupe-50">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 py-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-ivory-200">
            {item.imageUrl ? (
              <Image src={item.imageUrl} alt="" fill sizes="56px" className="object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            {item.slug ? (
              <Link
                href={`/product/${item.slug}`}
                className="block truncate text-sm text-charcoal-700 hover:text-wine-700"
              >
                {item.name}
              </Link>
            ) : (
              <p className="truncate text-sm text-charcoal-700">{item.name}</p>
            )}
            <p className="text-xs text-charcoal-400">
              {item.variantLabel ? `${item.variantLabel} · ` : ''}Qty {item.quantity} ×{' '}
              {formatPaiseShort(item.unitPricePaise)}
            </p>
          </div>
          <p className="text-sm font-medium text-charcoal-700">{formatPaiseShort(item.totalPaise)}</p>
        </li>
      ))}
    </ul>
  );
}

export function OrderTotals({
  order,
}: {
  order: {
    subtotalPaise: number;
    discountPaise: number;
    shippingPaise: number;
    taxPaise: number;
    totalPaise: number;
    couponCode: string | null;
  };
}) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between">
        <dt className="text-charcoal-400">Subtotal</dt>
        <dd className="text-charcoal-700">{formatPaiseShort(order.subtotalPaise)}</dd>
      </div>
      {order.discountPaise > 0 ? (
        <div className="flex justify-between">
          <dt className="text-charcoal-400">
            Discount{order.couponCode ? ` (${order.couponCode})` : ''}
          </dt>
          <dd className="text-success-600">−{formatPaiseShort(order.discountPaise)}</dd>
        </div>
      ) : null}
      <div className="flex justify-between">
        <dt className="text-charcoal-400">Shipping</dt>
        <dd className="text-charcoal-700">
          {order.shippingPaise === 0 ? (
            <span className="text-success-600">Free</span>
          ) : (
            formatPaiseShort(order.shippingPaise)
          )}
        </dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-charcoal-400">Tax (18% GST)</dt>
        <dd className="text-charcoal-700">{formatPaiseShort(order.taxPaise)}</dd>
      </div>
      <div className="flex justify-between border-t border-taupe-100 pt-2.5 text-base">
        <dt className="font-medium text-charcoal-700">Total</dt>
        <dd className="font-semibold text-wine-700">{formatPaiseShort(order.totalPaise)}</dd>
      </div>
    </dl>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge tone={ORDER_STATUS_TONE[status]} dot>
      {ORDER_STATUS_LABEL[status]}
    </Badge>
  );
}
