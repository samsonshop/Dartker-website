import { z } from 'zod';

export const addressSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the full name').max(80),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[- ]?)?[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  line1: z.string().trim().min(4, 'Enter the house/flat and street').max(160),
  line2: z.string().trim().max(160).optional().nullable(),
  city: z.string().trim().min(2, 'Enter the city').max(80),
  state: z.string().trim().min(2, 'Select the state').max(80),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode'),
  country: z.string().trim().default('India'),
});

export type AddressInput = z.infer<typeof addressSchema>;

export const cartLineSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
});

export const checkoutSchema = z.object({
  lines: z.array(cartLineSchema).min(1, 'Your cart is empty').max(50),
  couponCode: z.string().trim().max(32).nullish(),
  paymentMethod: z.enum(['COD', 'UPI', 'CARD', 'NETBANKING', 'WALLET']),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(160),
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
  billingSameAsShipping: z.boolean().default(true),
  saveAddress: z.boolean().default(false),
  customerNote: z.string().trim().max(500).optional().nullable(),
  idempotencyKey: z.string().trim().min(8).max(80),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const verifyPaymentSchema = z.object({
  orderId: z.string().uuid(),
  razorpayOrderId: z.string().min(4).max(80),
  razorpayPaymentId: z.string().min(4).max(80),
  razorpaySignature: z.string().min(16).max(256),
});

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;
