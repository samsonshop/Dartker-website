import { cn } from '@/lib/utils';

/**
 * Decorative botanical and sparkle artwork used across the storefront.
 *
 * Everything here is purely ornamental: it is `aria-hidden`, never intercepts
 * pointer events, and carries no layout weight, so it can be dropped into a
 * page without shifting a single existing element.
 */

/** A single pointed leaf, drawn from the origin up and to the right. */
const LEAF = 'M0 0C16-4 30-22 32-46 10-42-2-22 0 0Z';

/**
 * Leaves arranged along the stem. `side` mirrors the leaf across the stem and
 * `scale` tapers them towards the tip so the sprig reads as a real stem.
 */
const LEAVES: { x: number; y: number; side: 1 | -1; scale: number; tilt: number }[] = [
  { x: 108, y: 310, side: -1, scale: 1, tilt: -8 },
  { x: 106, y: 286, side: 1, scale: 0.96, tilt: 6 },
  { x: 105, y: 260, side: -1, scale: 0.92, tilt: -6 },
  { x: 106, y: 236, side: 1, scale: 0.87, tilt: 8 },
  { x: 108, y: 210, side: -1, scale: 0.81, tilt: -7 },
  { x: 111, y: 186, side: 1, scale: 0.75, tilt: 5 },
  { x: 114, y: 160, side: -1, scale: 0.68, tilt: -9 },
  { x: 118, y: 134, side: 1, scale: 0.61, tilt: 7 },
  { x: 122, y: 108, side: -1, scale: 0.53, tilt: -6 },
  { x: 126, y: 82, side: 1, scale: 0.45, tilt: 8 },
  { x: 130, y: 56, side: -1, scale: 0.36, tilt: -5 },
];

export function Sprig({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 340"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn('h-auto w-full', className)}
    >
      <path
        d="M110 338C96 262 100 170 133 24"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.7"
      />
      {LEAVES.map((leaf) => (
        <path
          key={`${leaf.x}-${leaf.y}`}
          d={LEAF}
          fill="currentColor"
          opacity="0.45"
          transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.tilt}) scale(${
            leaf.side * leaf.scale
          } ${leaf.scale})`}
        />
      ))}
    </svg>
  );
}

/** Four-point sparkle, centred on the origin of its own 40×40 box. */
export function Sparkle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-20 -20 40 40"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn('h-auto w-full', className)}
    >
      <path
        d="M0-16C1.9-6.4 6.4-1.9 16 0 6.4 1.9 1.9 6.4 0 16-1.9 6.4-6.4 1.9-16 0-6.4-1.9-1.9-6.4 0-16Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Sprigs scattered down both edges of a page. Positioned as percentages of the
 * container height so a short page (an empty category) and a long one (twelve
 * keychains) both end up evenly decorated.
 *
 * Must be rendered inside a `relative` ancestor that clips horizontally with
 * `overflow-x-clip` — not `overflow-hidden`, which would break the sticky
 * filter sidebar by turning the ancestor into a scroll container.
 */
export function PageDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none">
      <Sprig className="absolute -left-14 top-[3%] w-44 rotate-[14deg] text-blush-400/70 lg:w-64" />
      <Sprig className="absolute -right-16 top-[15%] w-48 -rotate-[24deg] scale-x-[-1] text-blush-400/60 lg:w-72" />
      <Sprig className="absolute -left-16 top-[40%] w-40 -rotate-[8deg] text-blush-400/55 lg:w-60" />
      <Sprig className="absolute -right-14 top-[57%] w-44 rotate-[18deg] scale-x-[-1] text-blush-400/60 lg:w-64" />
      <Sprig className="absolute -left-12 top-[77%] w-36 rotate-[22deg] text-blush-400/50 lg:w-52" />

      <Sparkle className="absolute left-[6%] top-[7%] w-4 text-gold-300/70" />
      <Sparkle className="absolute left-[3%] top-[10%] w-2.5 text-blush-400/60" />
      <Sparkle className="absolute right-[7%] top-[5%] w-3.5 text-gold-300/60" />
      <Sparkle className="absolute right-[4%] top-[46%] w-3 text-blush-400/50" />
      <Sparkle className="absolute left-[8%] top-[68%] w-3 text-gold-300/50" />
    </div>
  );
}
