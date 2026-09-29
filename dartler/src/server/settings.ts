import 'server-only';
import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';

export interface StoreSettings {
  id: string;
  storeName: string;
  supportEmail: string;
  supportPhone: string;
  freeShippingAbovePaise: number;
  flatShippingPaise: number;
  defaultTaxBps: number;
  returnWindowDays: number;
  lowStockThreshold: number;
  codEnabled: boolean;
  onlinePaymentEnabled: boolean;
  pickupPincode: string;
  pickupName: string;
  notifyOnOrder: boolean;
  notifyOnShipment: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const FALLBACK: StoreSettings = {
  id: 'default',
  storeName: 'Dartler',
  supportEmail: 'care@dartler.com',
  supportPhone: '+91 90000 00000',
  freeShippingAbovePaise: 99900,
  flatShippingPaise: 4900,
  defaultTaxBps: 1800,
  returnWindowDays: 7,
  lowStockThreshold: 10,
  codEnabled: true,
  onlinePaymentEnabled: true,
  pickupPincode: '641004',
  pickupName: 'Dartler Coimbatore',
  notifyOnOrder: true,
  notifyOnShipment: true,
};

/**
 * Store settings are read on nearly every request, so they are cached for the
 * lifetime of a single render pass.
 */
export const getStoreSettings = cache(async (): Promise<StoreSettings> => {
  const row = await db.query.storeSettings.findFirst({
    where: eq(t.storeSettings.id, 'default'),
  });
  return (row as StoreSettings | undefined) ?? { ...FALLBACK };
});

export async function updateStoreSettings(
  patch: Partial<Omit<StoreSettings, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<StoreSettings> {
  const [row] = await db
    .insert(t.storeSettings)
    .values({ id: 'default', ...patch })
    .onConflictDoUpdate({
      target: t.storeSettings.id,
      set: { ...patch, updatedAt: new Date() },
    })
    .returning();
  return row as StoreSettings;
}
