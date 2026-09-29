'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ProductGallery({
  images,
  productName,
}: {
  images: { id: string; url: string; alt: string }[];
  productName: string;
}) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  if (images.length === 0) {
    return <div className="aspect-square w-full rounded-2xl bg-ivory-200" aria-hidden="true" />;
  }

  const active = images[Math.min(index, images.length - 1)];
  const step = (delta: number) => setIndex((current) => (current + delta + images.length) % images.length);

  return (
    <>
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <ul className="flex gap-3 overflow-x-auto scrollbar-none sm:w-20 sm:flex-col sm:overflow-visible">
          {images.map((image, i) => (
            <li key={image.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-current={i === index}
                className={cn(
                  'relative block h-20 w-20 overflow-hidden rounded-xl border-2 transition-colors',
                  i === index ? 'border-wine-500' : 'border-transparent hover:border-taupe-200',
                )}
              >
                <Image src={image.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>

        <div className="relative flex-1 overflow-hidden rounded-2xl border border-taupe-100 bg-ivory-200">
          <div className="relative aspect-square w-full">
            <Image
              key={active.id}
              src={active.url}
              alt={active.alt || productName}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 46vw"
              className="animate-fade-in object-cover"
            />
          </div>

          <button
            type="button"
            onClick={() => setLightbox(true)}
            aria-label="Open full-size image"
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-charcoal-500 shadow-sm backdrop-blur transition-colors hover:text-wine-700"
          >
            <Expand className="h-4 w-4" />
          </button>

          {images.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-charcoal-500 shadow-sm backdrop-blur transition-colors hover:text-wine-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next image"
                className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-charcoal-500 shadow-sm backdrop-blur transition-colors hover:text-wine-700"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : null}
        </div>
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-charcoal-900/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${productName} enlarged image`}
          onClick={() => setLightbox(false)}
        >
          <button
            type="button"
            onClick={() => setLightbox(false)}
            aria-label="Close"
            className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative aspect-square w-full max-w-3xl">
            <Image src={active.url} alt={active.alt || productName} fill sizes="90vw" className="object-contain" />
          </div>
        </div>
      ) : null}
    </>
  );
}
