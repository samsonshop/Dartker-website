'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface HeroSlide {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  image: string;
}

export function Hero({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback(
    (next: number) => setIndex((current) => (next + slides.length) % slides.length),
    [slides.length],
  );

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const timer = window.setInterval(() => go(index + 1), 6500);
    return () => window.clearInterval(timer);
  }, [index, paused, go, slides.length]);

  const slide = slides[index];

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured collections"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="relative overflow-hidden rounded-3xl border border-taupe-100 bg-blush-100"
    >
      <div className="relative aspect-[16/11] w-full sm:aspect-[16/7] lg:aspect-[16/6]">
        {slides.map((item, i) => (
          <Image
            key={item.image + i}
            src={item.image}
            alt=""
            fill
            priority={i === 0}
            sizes="100vw"
            className={cn(
              'object-cover transition-opacity duration-700 ease-smooth',
              i === index ? 'opacity-100' : 'opacity-0',
            )}
          />
        ))}

        <div className="absolute inset-0 bg-gradient-to-r from-ivory-100/95 via-ivory-100/70 to-transparent" />

        <div className="absolute inset-0 flex items-center">
          <div className="w-full px-6 sm:px-10 lg:px-16">
            <div key={index} className="max-w-lg animate-fade-up">
              <p className="text-[11px] uppercase tracking-[0.25em] text-wine-600">{slide.eyebrow}</p>
              <h1 className="mt-3 font-serif text-3xl leading-tight text-charcoal-700 sm:text-4xl lg:text-5xl">
                {slide.title}
              </h1>
              <p className="mt-3 max-w-md text-sm text-charcoal-500 sm:text-base">{slide.subtitle}</p>
              <ButtonLink href={slide.ctaHref} size="lg" className="mt-6">
                {slide.ctaLabel}
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>

      {slides.length > 1 ? (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-charcoal-600 shadow-sm backdrop-blur transition-colors hover:bg-white sm:inline-flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-charcoal-600 shadow-sm backdrop-blur transition-colors hover:bg-white sm:inline-flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
            {slides.map((item, i) => (
              <button
                key={item.title}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === index ? 'w-6 bg-wine-600' : 'w-1.5 bg-charcoal-300/50 hover:bg-charcoal-400',
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
