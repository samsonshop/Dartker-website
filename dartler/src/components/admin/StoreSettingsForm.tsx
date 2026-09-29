'use client';

import { useActionState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { saveStoreSettingsAction } from '@/server/actions/admin-settings';
import type { ActionState } from '@/server/actions/admin-products';
import { paiseToRupees } from '@/lib/money';
import type { StoreSettings } from '@/server/settings';

const initial: ActionState = { ok: false };

export function StoreSettingsForm({
  settings,
  canManage,
}: {
  settings: StoreSettings;
  canManage: boolean;
}) {
  const { toast } = useToast();
  const [state, formAction, pending] = useActionState(saveStoreSettingsAction, initial);

  useEffect(() => {
    if (state.ok) toast({ title: 'Settings saved', tone: 'success' });
    else if (state.error) toast({ title: 'Could not save settings', description: state.error, tone: 'error' });
  }, [state, toast]);

  return (
    <form action={formAction} className="space-y-5">
      <fieldset disabled={!canManage} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Store name" name="storeName" defaultValue={settings.storeName} required />
          <Input
            label="Support email"
            name="supportEmail"
            type="email"
            defaultValue={settings.supportEmail}
            required
          />
          <Input label="Support phone" name="supportPhone" defaultValue={settings.supportPhone} required />
          <Input label="Pickup location name" name="pickupName" defaultValue={settings.pickupName} required />
          <Input
            label="Pickup pincode"
            name="pickupPincode"
            inputMode="numeric"
            maxLength={6}
            defaultValue={settings.pickupPincode}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label="Free shipping above (₹)"
            name="freeShippingAbove"
            inputMode="decimal"
            defaultValue={String(paiseToRupees(settings.freeShippingAbovePaise))}
            required
          />
          <Input
            label="Flat shipping fee (₹)"
            name="flatShipping"
            inputMode="decimal"
            defaultValue={String(paiseToRupees(settings.flatShippingPaise))}
            required
          />
          <Input
            label="Default GST (%)"
            name="defaultTaxPercent"
            inputMode="decimal"
            defaultValue={String(settings.defaultTaxBps / 100)}
            required
          />
          <Input
            label="Return window (days)"
            name="returnWindowDays"
            inputMode="numeric"
            defaultValue={String(settings.returnWindowDays)}
            required
            hint="How long after delivery a return can be requested."
          />
          <Input
            label="Low-stock threshold"
            name="lowStockThreshold"
            inputMode="numeric"
            defaultValue={String(settings.lowStockThreshold)}
            required
            hint="Used for the dashboard's low-stock count."
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Checkbox
            name="codEnabled"
            defaultChecked={settings.codEnabled}
            label="Accept Cash on Delivery"
          />
          <Checkbox
            name="onlinePaymentEnabled"
            defaultChecked={settings.onlinePaymentEnabled}
            label="Accept online payments (UPI, cards, net banking)"
          />
          <Checkbox
            name="notifyOnOrder"
            defaultChecked={settings.notifyOnOrder}
            label="Notify customers when an order is placed"
          />
          <Checkbox
            name="notifyOnShipment"
            defaultChecked={settings.notifyOnShipment}
            label="Notify customers when a shipment is created"
          />
        </div>

        {canManage ? (
          <Button type="submit" loading={pending}>
            Save settings
          </Button>
        ) : (
          <p className="text-[13px] text-charcoal-400">
            Your role can view these settings but not change them.
          </p>
        )}
      </fieldset>
    </form>
  );
}
