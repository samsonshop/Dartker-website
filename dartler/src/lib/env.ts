import { z } from 'zod';

/**
 * Server-only configuration. Importing this from a client component is a build
 * error by design — secrets must never reach the browser.
 */
const serverSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  AUTH_SECRET: z
    .string()
    .min(32, 'AUTH_SECRET must be at least 32 characters — generate one with crypto.randomBytes(48)'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),

  DELHIVERY_API_TOKEN: z.string().optional().default(''),
  DELHIVERY_BASE_URL: z.string().optional().default('https://staging-express.delhivery.com'),
  DELHIVERY_PICKUP_NAME: z.string().optional().default(''),
  DELHIVERY_CLIENT_NAME: z.string().optional().default(''),
  DELHIVERY_USE_MOCK: z.string().optional().default('true'),

  STORAGE_DRIVER: z.enum(['local', 's3', 'supabase']).optional().default('local'),
  SUPABASE_URL: z.string().optional().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),
  SUPABASE_STORAGE_BUCKET: z.string().optional().default('dartler'),
});

type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
  }
  cached = parsed.data;
  return cached;
}

/** Values that are safe to render into the browser bundle. */
export const publicEnv = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? '',
  gaMeasurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '',
  instagramUrl: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? 'https://instagram.com',
  facebookUrl: process.env.NEXT_PUBLIC_FACEBOOK_URL ?? 'https://facebook.com',
};

export function isRazorpayConfigured(): boolean {
  const config = env();
  return Boolean(config.RAZORPAY_KEY_ID && config.RAZORPAY_KEY_SECRET);
}

export function isDelhiveryConfigured(): boolean {
  const config = env();
  return Boolean(config.DELHIVERY_API_TOKEN) && config.DELHIVERY_USE_MOCK !== 'true';
}
