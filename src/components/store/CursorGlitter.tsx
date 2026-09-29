'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

/**
 * A decorative trail of sparkles that follows the cursor.
 *
 * Deliberately conservative: it only runs for fine (mouse) pointers on wide
 * viewports, bails out entirely under `prefers-reduced-motion`, rate-limits
 * emission, caps how many particles can be alive at once, and removes each
 * element the moment its tween finishes so the DOM never grows.
 */

const GLYPHS = ['✦', '✧', '✶', '⋆', '★'];

/** Muted gold and wine from the brand palette, plus a near-white highlight. */
const COLORS = ['#CFA254', '#DBB877', '#C4637C', '#F6E1E6'];

/** Most particles alive at any moment. */
const MAX_PARTICLES = 24;
/** Minimum gap between spawns, in ms. */
const EMIT_INTERVAL = 55;
/** Pointer must travel at least this far since the last spawn, in px. */
const MIN_TRAVEL = 14;

export function CursorGlitter() {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    // Touch devices have no hovering cursor to trail, and the effect would only
    // cost battery there. Reduced-motion users opt out of it entirely.
    const finePointer = window.matchMedia('(pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!finePointer.matches || reducedMotion.matches || window.innerWidth < 1024) return;

    const random = gsap.utils.random;

    let live = 0;
    let lastEmit = 0;
    let lastX = 0;
    let lastY = 0;
    let seeded = false;
    let queued: { x: number; y: number } | null = null;
    let frame = 0;

    function spawn(x: number, y: number) {
      const star = document.createElement('span');
      star.textContent = random(GLYPHS) as string;

      const color = random(COLORS) as string;
      const size = random(9, 18);

      gsap.set(star, {
        position: 'fixed',
        left: x,
        top: y,
        xPercent: -50,
        yPercent: -50,
        fontSize: size,
        lineHeight: 1,
        color,
        // The soft double halo is what reads as "premium" rather than "clip art".
        textShadow: `0 0 6px ${color}99, 0 0 16px ${color}4D`,
        rotation: random(-70, 70),
        opacity: 0,
        scale: 0,
        willChange: 'transform, opacity',
      });

      layer!.appendChild(star);
      live += 1;

      const angle = random(0, Math.PI * 2);
      const distance = random(16, 52);

      gsap
        .timeline({
          onComplete: () => {
            star.remove();
            live -= 1;
          },
        })
        .to(star, {
          scale: random(0.7, 1.15),
          opacity: random(0.55, 0.95),
          duration: 0.18,
          ease: 'back.out(2.4)',
        })
        .to(
          star,
          {
            // Scatter outward, with a touch of gravity so the trail settles.
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance + random(8, 28),
            rotation: `+=${random(-200, 200)}`,
            scale: 0,
            opacity: 0,
            duration: random(0.6, 1.15),
            ease: 'power2.out',
          },
          '>-0.06',
        );
    }

    // Pointer events can fire faster than the display refreshes, so the work is
    // deferred to a single rAF tick per frame.
    function flush() {
      frame = 0;
      const point = queued;
      queued = null;
      if (!point) return;

      const now = performance.now();
      if (now - lastEmit < EMIT_INTERVAL || live >= MAX_PARTICLES) return;
      if (Math.hypot(point.x - lastX, point.y - lastY) < MIN_TRAVEL) return;

      lastEmit = now;
      lastX = point.x;
      lastY = point.y;
      spawn(point.x, point.y);
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerType !== 'mouse') return;

      if (!seeded) {
        // Skip the first move so the trail starts from where the cursor is,
        // not from the top-left corner.
        seeded = true;
        lastX = event.clientX;
        lastY = event.clientY;
        return;
      }

      queued = { x: event.clientX, y: event.clientY };
      if (!frame) frame = window.requestAnimationFrame(flush);
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true });

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      if (frame) window.cancelAnimationFrame(frame);
      gsap.killTweensOf(layer.children);
      layer.replaceChildren();
    };
  }, []);

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      // pointer-events:none keeps clicks, scrolling and hover states untouched.
      className="pointer-events-none fixed inset-0 z-[9999] select-none overflow-hidden"
    />
  );
}
