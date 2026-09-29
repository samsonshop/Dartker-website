import type { MetadataRoute } from 'next';
import { getCategories, getProductSlugs } from '@/server/catalog';
import { POLICIES } from '@/content/policies';
import { publicEnv } from '@/lib/env';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl.replace(/\/$/, '');

  const [categories, products] = await Promise.all([getCategories(false), getProductSlugs()]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/category`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/search`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${base}/about`, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${base}/contact`, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${base}/faq`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/track-order`, changeFrequency: 'monthly', priority: 0.4 },
  ];

  return [
    ...staticRoutes,
    ...categories.map((category) => ({
      url: `${base}/category/${category.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...products.map((product) => ({
      url: `${base}/product/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...POLICIES.map((policy) => ({
      url: `${base}/policies/${policy.slug}`,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    })),
  ];
}
