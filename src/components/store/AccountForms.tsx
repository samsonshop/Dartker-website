'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import {
  changeCustomerPasswordAction,
  createServiceRequestAction,
  deleteAddressAction,
  saveAddressAction,
  updateProfileAction,
  type AccountState,
} from '@/server/actions/account';
import { INDIAN_STATES } from '@/lib/validation/checkout';

const initial: AccountState = { ok: false };

function Alert({ state }: { state: AccountState }) {
  if (!state.error) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl bg-danger-50 px-3.5 py-2.5 text-[13px] text-danger-600"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {state.error}
    </p>
  );
}

export function ProfileForm({
  profile,
}: {
  profile: { fullName: string; email: string; phone: string | null; marketingOptIn: boolean };
}) {
  const { toast } = useToast();
  const [state, formAction, pending] = useActionState(updateProfileAction, initial);

  useEffect(() => {
    if (state.ok) toast({ title: 'Profile updated', tone: 'success' });
  }, [state, toast]);

  return (
    <form action={formAction} className="space-y-4">
      <Alert state={state} />
      <Input label="Full name" name="fullName" defaultValue={profile.fullName} required />
      <Input label="Email address" value={profile.email} disabled hint="Contact support to change your email." />
      <Input label="Mobile number" name="phone" defaultValue={profile.phone ?? ''} required />
      <Checkbox
        name="marketingOptIn"
        defaultChecked={profile.marketingOptIn}
        label="Email me new arrivals and private sales"
      />
      <Button type="submit" loading={pending}>
        Save changes
      </Button>
    </form>
  );
}

export function CustomerPasswordForm() {
  const { toast } = useToast();
  const [state, formAction, pending] = useActionState(changeCustomerPasswordAction, initial);

  useEffect(() => {
    if (state.ok) toast({ title: 'Password changed', description: state.message, tone: 'success' });
  }, [state, toast]);

  return (
    <form action={formAction} className="space-y-4">
      <Alert state={state} />
      <Input label="Current password" name="current" type="password" autoComplete="current-password" required />
      <Input
        label="New password"
        name="next"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters, with a letter and a number."
      />
      <Input label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required />
      <Button type="submit" variant="outline" loading={pending}>
        Change password
      </Button>
    </form>
  );
}

export interface AddressView {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export function AddressBook({ addresses }: { addresses: AddressView[] }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<AddressView | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AddressView | null>(null);
  const [state, formAction, pending] = useActionState(saveAddressAction, initial);
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    if (state.ok) {
      toast({ title: 'Address saved', tone: 'success' });
      setEditing(null);
    }
  }, [state, toast]);

  const draft = editing === 'new' ? null : editing;

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-xl text-charcoal-700">Saved addresses</h2>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus className="h-3.5 w-3.5" />
          Add address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <EmptyState
          compact
          title="No saved addresses yet"
          description="Add one now and checkout will fill itself in next time."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="rounded-2xl border border-taupe-100 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-medium text-charcoal-700">
                  {address.fullName}
                  {address.isDefault ? <Badge tone="blush">Default</Badge> : null}
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(address)}
                  aria-label={`Delete address for ${address.fullName}`}
                  className="rounded-lg p-1.5 text-charcoal-300 hover:bg-danger-50 hover:text-danger-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <address className="mt-1.5 text-[13px] not-italic leading-relaxed text-charcoal-500">
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
                {address.phone}
              </address>
              <button
                type="button"
                onClick={() => setEditing(address)}
                className="mt-2.5 text-xs font-medium text-wine-700 hover:underline"
              >
                Edit
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={draft ? 'Edit address' : 'Add an address'}
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="addressId" value={draft?.id ?? ''} />
          <Alert state={state} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Full name"
              name="fullName"
              defaultValue={draft?.fullName ?? ''}
              required
              error={state.fieldErrors?.fullName}
            />
            <Input
              label="Mobile number"
              name="phone"
              defaultValue={draft?.phone ?? ''}
              required
              error={state.fieldErrors?.phone}
            />
            <Input
              label="Address"
              name="line1"
              defaultValue={draft?.line1 ?? ''}
              required
              error={state.fieldErrors?.line1}
              wrapperClassName="sm:col-span-2"
            />
            <Input
              label="Landmark / apartment"
              name="line2"
              defaultValue={draft?.line2 ?? ''}
              wrapperClassName="sm:col-span-2"
            />
            <Input
              label="City"
              name="city"
              defaultValue={draft?.city ?? ''}
              required
              error={state.fieldErrors?.city}
            />
            <Select label="State" name="state" defaultValue={draft?.state ?? 'Tamil Nadu'} required>
              {INDIAN_STATES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
            <Input
              label="Pincode"
              name="pincode"
              inputMode="numeric"
              maxLength={6}
              defaultValue={draft?.pincode ?? ''}
              required
              error={state.fieldErrors?.pincode}
            />
          </div>

          <Checkbox
            name="isDefault"
            defaultChecked={draft?.isDefault ?? addresses.length === 0}
            label="Use this as my default address"
          />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save address
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        destructive
        loading={busy}
        title="Delete this address?"
        message="You can always add it again later."
        confirmLabel="Delete"
        onConfirm={() => {
          const address = confirmDelete;
          if (!address) return;
          startTransition(async () => {
            const result = await deleteAddressAction(address.id);
            setConfirmDelete(null);
            toast({
              title: result.ok ? 'Address removed' : 'Could not remove',
              description: result.message ?? result.error,
              tone: result.ok ? 'success' : 'error',
            });
          });
        }}
      />
    </>
  );
}

const RETURN_REASONS = [
  'Received a damaged item',
  'Wrong item delivered',
  'Size or fit issue',
  'Not as described',
  'Quality not as expected',
  'Changed my mind',
];

const CANCEL_REASONS = [
  'Ordered by mistake',
  'Found a better price elsewhere',
  'Delivery is taking too long',
  'Changed my mind',
  'Want to change the address or payment method',
];

export function ServiceRequestForm({
  orders,
  defaultOrderNumber,
  defaultType,
}: {
  orders: { orderNumber: string; label: string; canCancel: boolean; canReturn: boolean }[];
  defaultOrderNumber?: string;
  defaultType?: 'RETURN' | 'CANCELLATION';
}) {
  const { toast } = useToast();
  const [state, formAction, pending] = useActionState(createServiceRequestAction, initial);
  const [orderNumber, setOrderNumber] = useState(defaultOrderNumber ?? orders[0]?.orderNumber ?? '');
  const [type, setType] = useState<'RETURN' | 'CANCELLATION'>(defaultType ?? 'RETURN');

  useEffect(() => {
    if (state.ok) toast({ title: 'Request submitted', description: state.message, tone: 'success' });
  }, [state, toast]);

  const selected = orders.find((order) => order.orderNumber === orderNumber);
  const reasons = type === 'RETURN' ? RETURN_REASONS : CANCEL_REASONS;

  if (orders.length === 0) {
    return (
      <EmptyState
        compact
        title="No eligible orders"
        description="Returns open after delivery, and cancellations close once an order is dispatched."
      />
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <Alert state={state} />
      {state.ok ? (
        <p className="rounded-xl bg-success-50 px-3.5 py-2.5 text-[13px] text-success-600">
          {state.message}
        </p>
      ) : null}

      <Select
        label="Order"
        name="orderNumber"
        value={orderNumber}
        onChange={(event) => setOrderNumber(event.target.value)}
        required
      >
        {orders.map((order) => (
          <option key={order.orderNumber} value={order.orderNumber}>
            {order.label}
          </option>
        ))}
      </Select>

      <Select
        label="Request type"
        name="type"
        value={type}
        onChange={(event) => setType(event.target.value as 'RETURN' | 'CANCELLATION')}
        required
      >
        {selected?.canReturn ? <option value="RETURN">Return</option> : null}
        {selected?.canCancel ? <option value="CANCELLATION">Cancellation</option> : null}
      </Select>

      <Select label="Reason" name="reason" required>
        {reasons.map((reason) => (
          <option key={reason} value={reason}>
            {reason}
          </option>
        ))}
      </Select>

      <Textarea
        label="Additional details (optional)"
        name="details"
        maxLength={600}
        className="min-h-[100px]"
        placeholder="Tell us what happened so we can sort it out quickly."
      />

      <Button type="submit" loading={pending} fullWidth>
        Submit request
      </Button>
    </form>
  );
}
