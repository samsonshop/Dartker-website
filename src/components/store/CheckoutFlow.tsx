'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, CreditCard, Landmark, Smartphone, Truck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input, Radio, Select, Textarea } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { formatPaiseShort } from '@/lib/money';
import { cn } from '@/lib/utils';
import { addressSchema, INDIAN_STATES, type AddressInput } from '@/lib/validation/checkout';
import { useCart } from './CartProvider';

type Step = 1 | 2 | 3;

const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: 'Shipping' },
  { id: 2, label: 'Payment' },
  { id: 3, label: 'Review' },
];

const PAYMENT_METHODS = [
  { value: 'UPI', label: 'UPI', description: 'GPay, PhonePe, Paytm and more', Icon: Smartphone },
  { value: 'CARD', label: 'Credit / Debit Card', description: 'Visa, Mastercard, RuPay', Icon: CreditCard },
  { value: 'NETBANKING', label: 'Net Banking', description: 'All major Indian banks', Icon: Landmark },
  { value: 'COD', label: 'Cash on Delivery', description: 'Pay the courier when it arrives', Icon: Truck },
] as const;

type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value'];

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const emptyAddress: AddressInput = {
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: 'Tamil Nadu',
  pincode: '',
  country: 'India',
};

export function CheckoutFlow({
  customer,
  savedAddress,
  codEnabled,
  onlinePaymentEnabled,
}: {
  customer: { email: string; fullName: string; phone: string | null } | null;
  savedAddress: AddressInput | null;
  codEnabled: boolean;
  onlinePaymentEnabled: boolean;
}) {
  const cart = useCart();
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(1);
  const [address, setAddress] = useState<AddressInput>(
    savedAddress ?? {
      ...emptyAddress,
      fullName: customer?.fullName ?? '',
      phone: customer?.phone ?? '',
    },
  );
  const [email, setEmail] = useState(customer?.email ?? '');
  const [billingSame, setBillingSame] = useState(true);
  const [billing, setBilling] = useState<AddressInput>(emptyAddress);
  const [saveAddress, setSaveAddress] = useState(Boolean(customer));
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<PaymentMethod>(
    onlinePaymentEnabled ? 'UPI' : 'COD',
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // One key per checkout attempt: a refresh or a double click reuses the same
  // order instead of creating a second one.
  const idempotencyKey = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const payableLines = useMemo(
    () => cart.lines.filter((line) => !line.unavailable && line.quantity > 0),
    [cart.lines],
  );

  useEffect(() => {
    if (cart.hydrated && payableLines.length === 0) setStep(1);
  }, [cart.hydrated, payableLines.length]);

  function validateShipping(): boolean {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
    const parsed = addressSchema.safeParse(address);
    const billingParsed = billingSame ? null : addressSchema.safeParse(billing);

    const next: Record<string, string> = {};
    if (!emailOk) next.email = 'Enter a valid email address';
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !next[key]) next[key] = issue.message;
      }
    }
    if (billingParsed && !billingParsed.success) {
      for (const issue of billingParsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string') next[`billing.${key}`] = issue.message;
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function loadRazorpayScript(): Promise<boolean> {
    if (window.Razorpay) return true;
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  async function placeOrder() {
    if (payableLines.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: payableLines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
          })),
          couponCode: cart.couponCode,
          paymentMethod: method,
          email: email.trim(),
          shippingAddress: address,
          billingAddress: billingSame ? undefined : billing,
          billingSameAsShipping: billingSame,
          saveAddress,
          customerNote: note.trim() || null,
          idempotencyKey: idempotencyKey.current,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        code?: string;
        status?: string;
        orderId?: string;
        orderNumber?: string;
        amountPaise?: number;
        razorpayOrderId?: string;
        razorpayKeyId?: string;
        redirectTo?: string;
      };

      if (!response.ok) {
        setSubmitError(data.error ?? 'We could not place your order.');
        if (data.code === 'OUT_OF_STOCK') cart.refresh();
        return;
      }

      if (data.status === 'confirmed' && data.redirectTo) {
        cart.clearCart();
        router.push(data.redirectTo);
        return;
      }

      if (data.status === 'payment_required' && data.razorpayOrderId) {
        const loaded = await loadRazorpayScript();
        if (!loaded || !window.Razorpay) {
          setSubmitError(
            'The payment window could not load. Check your connection, or choose Cash on Delivery.',
          );
          return;
        }

        const checkout = new window.Razorpay({
          key: data.razorpayKeyId,
          amount: data.amountPaise,
          currency: 'INR',
          name: 'Dartler',
          description: `Order ${data.orderNumber}`,
          order_id: data.razorpayOrderId,
          prefill: { name: address.fullName, email: email.trim(), contact: address.phone },
          theme: { color: '#8E2F45' },
          modal: {
            ondismiss: () => {
              setSubmitting(false);
              toast({
                title: 'Payment cancelled',
                description: 'Your order is saved as pending — you can pay again from your orders.',
                tone: 'warning',
              });
            },
          },
          handler: async (result: RazorpayResponse) => {
            const verification = await fetch('/api/checkout/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: data.orderId,
                razorpayOrderId: result.razorpay_order_id,
                razorpayPaymentId: result.razorpay_payment_id,
                razorpaySignature: result.razorpay_signature,
              }),
            });
            const verified = (await verification.json()) as { error?: string; redirectTo?: string };
            if (!verification.ok) {
              setSubmitError(verified.error ?? 'We could not verify your payment.');
              setSubmitting(false);
              return;
            }
            cart.clearCart();
            router.push(verified.redirectTo ?? `/order/${data.orderNumber}`);
          },
        });
        checkout.open();
        return;
      }

      setSubmitError('Unexpected response from the server. Please try again.');
    } catch {
      setSubmitError('Network problem — please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!cart.hydrated) {
    return (
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <Skeleton className="h-96 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (payableLines.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          title="There is nothing to check out"
          description="Your cart is empty, or the items in it are no longer available."
          action={
            <Link
              href="/category"
              className="inline-flex h-11 items-center rounded-xl bg-wine-600 px-5 text-sm font-medium text-white hover:bg-wine-700"
            >
              Browse products
            </Link>
          }
        />
      </div>
    );
  }

  const availableMethods = PAYMENT_METHODS.filter((option) =>
    option.value === 'COD' ? codEnabled : onlinePaymentEnabled,
  );

  return (
    <div className="mt-6">
      <ol className="mb-8 flex items-center gap-2" aria-label="Checkout steps">
        {STEPS.map((entry, index) => {
          const done = step > entry.id;
          const active = step === entry.id;
          return (
            <li key={entry.id} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => (entry.id < step ? setStep(entry.id) : undefined)}
                disabled={entry.id > step}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-full px-1 py-1 text-[13px] font-medium transition-colors',
                  entry.id < step && 'cursor-pointer',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs',
                    done
                      ? 'bg-success-500 text-white'
                      : active
                        ? 'bg-wine-600 text-white'
                        : 'bg-taupe-100 text-charcoal-400',
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : entry.id}
                </span>
                <span className={active || done ? 'text-charcoal-700' : 'text-charcoal-300'}>
                  {entry.label}
                </span>
              </button>
              {index < STEPS.length - 1 ? (
                <span
                  className={cn('h-px flex-1', step > entry.id ? 'bg-success-500' : 'bg-taupe-200')}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-taupe-100 bg-white p-5 sm:p-6">
          {step === 1 ? (
            <section aria-labelledby="shipping-heading">
              <h2 id="shipping-heading" className="font-serif text-xl text-charcoal-700">
                Shipping details
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Input
                  label="Full name"
                  required
                  value={address.fullName}
                  onChange={(event) => setAddress({ ...address, fullName: event.target.value })}
                  error={errors.fullName}
                  autoComplete="name"
                />
                <Input
                  label="Mobile number"
                  required
                  value={address.phone}
                  onChange={(event) => setAddress({ ...address, phone: event.target.value })}
                  error={errors.phone}
                  autoComplete="tel"
                  placeholder="98765 43210"
                />
                <Input
                  label="Email address"
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  error={errors.email}
                  autoComplete="email"
                  wrapperClassName="sm:col-span-2"
                  hint="Order confirmation and tracking updates go here."
                />
                <Input
                  label="Address"
                  required
                  value={address.line1}
                  onChange={(event) => setAddress({ ...address, line1: event.target.value })}
                  error={errors.line1}
                  autoComplete="address-line1"
                  wrapperClassName="sm:col-span-2"
                  placeholder="House no, Street, Area"
                />
                <Input
                  label="Landmark / apartment"
                  value={address.line2 ?? ''}
                  onChange={(event) => setAddress({ ...address, line2: event.target.value })}
                  autoComplete="address-line2"
                  wrapperClassName="sm:col-span-2"
                />
                <Input
                  label="City"
                  required
                  value={address.city}
                  onChange={(event) => setAddress({ ...address, city: event.target.value })}
                  error={errors.city}
                  autoComplete="address-level2"
                />
                <Select
                  label="State"
                  required
                  value={address.state}
                  onChange={(event) => setAddress({ ...address, state: event.target.value })}
                  error={errors.state}
                >
                  {INDIAN_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Pincode"
                  required
                  inputMode="numeric"
                  maxLength={6}
                  value={address.pincode}
                  onChange={(event) =>
                    setAddress({ ...address, pincode: event.target.value.replace(/\D/g, '') })
                  }
                  error={errors.pincode}
                  autoComplete="postal-code"
                />
              </div>

              <div className="mt-5 space-y-3">
                <Checkbox
                  checked={billingSame}
                  onChange={(event) => setBillingSame(event.target.checked)}
                  label="Billing address is the same as shipping"
                />
                {customer ? (
                  <Checkbox
                    checked={saveAddress}
                    onChange={(event) => setSaveAddress(event.target.checked)}
                    label="Save this address to my account"
                  />
                ) : null}
              </div>

              {!billingSame ? (
                <div className="mt-5 rounded-xl border border-taupe-100 bg-ivory-50 p-4">
                  <h3 className="mb-3 text-sm font-medium text-charcoal-600">Billing address</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Full name"
                      required
                      value={billing.fullName}
                      onChange={(event) => setBilling({ ...billing, fullName: event.target.value })}
                      error={errors['billing.fullName']}
                    />
                    <Input
                      label="Mobile number"
                      required
                      value={billing.phone}
                      onChange={(event) => setBilling({ ...billing, phone: event.target.value })}
                      error={errors['billing.phone']}
                    />
                    <Input
                      label="Address"
                      required
                      value={billing.line1}
                      onChange={(event) => setBilling({ ...billing, line1: event.target.value })}
                      error={errors['billing.line1']}
                      wrapperClassName="sm:col-span-2"
                    />
                    <Input
                      label="City"
                      required
                      value={billing.city}
                      onChange={(event) => setBilling({ ...billing, city: event.target.value })}
                      error={errors['billing.city']}
                    />
                    <Select
                      label="State"
                      required
                      value={billing.state}
                      onChange={(event) => setBilling({ ...billing, state: event.target.value })}
                      error={errors['billing.state']}
                    >
                      {INDIAN_STATES.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </Select>
                    <Input
                      label="Pincode"
                      required
                      inputMode="numeric"
                      maxLength={6}
                      value={billing.pincode}
                      onChange={(event) =>
                        setBilling({ ...billing, pincode: event.target.value.replace(/\D/g, '') })
                      }
                      error={errors['billing.pincode']}
                    />
                  </div>
                </div>
              ) : null}

              <Button
                className="mt-6"
                size="lg"
                fullWidth
                onClick={() => {
                  if (validateShipping()) setStep(2);
                }}
              >
                Continue to Payment
              </Button>
            </section>
          ) : null}

          {step === 2 ? (
            <section aria-labelledby="payment-heading">
              <h2 id="payment-heading" className="font-serif text-xl text-charcoal-700">
                Payment method
              </h2>

              <div className="mt-5 space-y-2.5">
                {availableMethods.map((option) => (
                  <Radio
                    key={option.value}
                    name="payment"
                    value={option.value}
                    checked={method === option.value}
                    onChange={() => setMethod(option.value)}
                    label={
                      <span className="flex items-center gap-2 font-medium text-charcoal-700">
                        <option.Icon className="h-4 w-4 text-wine-600" />
                        {option.label}
                      </span>
                    }
                    description={option.description}
                  />
                ))}
              </div>

              <Textarea
                label="Order note (optional)"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                placeholder="Delivery instructions, gift message…"
                wrapperClassName="mt-5"
              />

              <div className="mt-6 flex gap-3">
                <Button variant="outline" size="lg" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button size="lg" fullWidth onClick={() => setStep(3)}>
                  Review order
                </Button>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section aria-labelledby="review-heading">
              <h2 id="review-heading" className="font-serif text-xl text-charcoal-700">
                Review and place your order
              </h2>

              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-taupe-100 p-4">
                  <dt className="text-[13px] font-medium text-charcoal-500">Shipping to</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-charcoal-600">
                    {address.fullName}
                    <br />
                    {address.line1}
                    {address.line2 ? (
                      <>
                        <br />
                        {address.line2}
                      </>
                    ) : null}
                    <br />
                    {address.city}, {address.state} {address.pincode}
                    <br />
                    {address.phone} · {email}
                  </dd>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="mt-2 text-xs font-medium text-wine-700 hover:underline"
                  >
                    Change
                  </button>
                </div>
                <div className="rounded-xl border border-taupe-100 p-4">
                  <dt className="text-[13px] font-medium text-charcoal-500">Paying with</dt>
                  <dd className="mt-1.5 text-sm text-charcoal-600">
                    {PAYMENT_METHODS.find((option) => option.value === method)?.label}
                  </dd>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="mt-2 text-xs font-medium text-wine-700 hover:underline"
                  >
                    Change
                  </button>
                </div>
              </dl>

              {submitError ? (
                <p
                  role="alert"
                  className="mt-5 flex items-start gap-2 rounded-xl bg-danger-50 px-3.5 py-2.5 text-[13px] text-danger-600"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {submitError}
                </p>
              ) : null}

              <div className="mt-6 flex gap-3">
                <Button variant="outline" size="lg" onClick={() => setStep(2)} disabled={submitting}>
                  Back
                </Button>
                <Button size="lg" fullWidth onClick={placeOrder} loading={submitting}>
                  {method === 'COD'
                    ? 'Place order'
                    : `Pay ${cart.totals ? formatPaiseShort(cart.totals.totalPaise) : ''}`}
                </Button>
              </div>

              <p className="mt-3 text-center text-xs text-charcoal-300">
                By placing this order you agree to our{' '}
                <Link href="/policies/terms" className="underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/policies/returns" className="underline">
                  Return Policy
                </Link>
                .
              </p>
            </section>
          ) : null}
        </div>

        <aside className="sticky top-32 rounded-2xl border border-taupe-100 bg-white p-5">
          <h2 className="font-serif text-lg text-charcoal-700">Order summary</h2>

          <ul className="mt-4 space-y-3 border-b border-taupe-100 pb-4">
            {payableLines.map((line) => (
              <li key={line.key} className="flex items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-ivory-200">
                  {line.imageUrl ? (
                    <Image src={line.imageUrl} alt={line.name} fill sizes="56px" className="object-cover" />
                  ) : null}
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-charcoal-600 px-1 text-[10px] text-white">
                    {line.quantity}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-charcoal-700">{line.name}</p>
                  {line.variantLabel ? (
                    <p className="text-xs text-charcoal-300">{line.variantLabel}</p>
                  ) : null}
                </div>
                <p className="text-sm font-medium text-charcoal-700">
                  {formatPaiseShort(line.lineTotalPaise)}
                </p>
              </li>
            ))}
          </ul>

          {cart.totals ? (
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-charcoal-400">Subtotal</dt>
                <dd className="text-charcoal-700">{formatPaiseShort(cart.totals.subtotalPaise)}</dd>
              </div>
              {cart.totals.discountPaise > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-charcoal-400">Discount</dt>
                  <dd className="text-success-600">−{formatPaiseShort(cart.totals.discountPaise)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-charcoal-400">Shipping</dt>
                <dd className="text-charcoal-700">
                  {cart.totals.shippingPaise === 0 ? (
                    <span className="text-success-600">Free</span>
                  ) : (
                    formatPaiseShort(cart.totals.shippingPaise)
                  )}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-charcoal-400">Tax (18% GST)</dt>
                <dd className="text-charcoal-700">{formatPaiseShort(cart.totals.taxPaise)}</dd>
              </div>
              <div className="flex justify-between border-t border-taupe-100 pt-2.5 text-base">
                <dt className="font-medium text-charcoal-700">Total</dt>
                <dd className="font-semibold text-wine-700">
                  {formatPaiseShort(cart.totals.totalPaise)}
                </dd>
              </div>
            </dl>
          ) : null}

          <p className="mt-4 text-xs text-charcoal-300">
            Totals are recalculated on the server when your order is placed, so the amount you pay
            always matches live prices and stock.
          </p>
        </aside>
      </div>
    </div>
  );
}
