/**
 * Generates Dartler's placeholder art: soft, brand-toned SVG illustrations for
 * every category, product, hero slide and testimonial avatar.
 *
 * These are real files on disk referenced by the database exactly like a real
 * photograph would be, so swapping in studio photography later is a matter of
 * replacing the file (or the URL in the products table) — no code changes.
 *
 *   node scripts/generate-images.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'images');

const GROUNDS = [
  ['#F7E9E4', '#EFD6CF'],
  ['#F3E7DC', '#E7D3C2'],
  ['#EFE7E2', '#E0D2C9'],
  ['#F8EFE6', '#EDDCCB'],
  ['#F1E4E4', '#E3CFD0'],
];

const INK = '#4A3B36';
const INK_SOFT = '#6E5A52';
const GOLD = '#C2954E';
const WINE = '#8E2F45';
const CREAM = '#FBF6F1';
const TAUPE = '#C6AF9C';

function svg(inner, ground, seed = 0) {
  const [a, b] = GROUNDS[seed % GROUNDS.length];
  const [g1, g2] = ground ?? [a, b];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800" role="img">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${g1}"/>
      <stop offset="100%" stop-color="${g2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.62">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#5B4038" flood-opacity="0.16"/>
    </filter>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <rect width="800" height="800" fill="url(#glow)"/>
  <g filter="url(#soft)">${inner}</g>
</svg>
`;
}

/* ------------------------------------------------------------------ art */

const art = {
  combs: () => `
    <g transform="translate(400 400) rotate(-18)">
      <rect x="-230" y="-58" width="460" height="86" rx="43" fill="${INK}"/>
      <rect x="-210" y="-42" width="300" height="18" rx="9" fill="${GOLD}" opacity="0.5"/>
      ${Array.from({ length: 22 }, (_, i) => `<rect x="${-224 + i * 20}" y="26" width="8" height="150" rx="4" fill="${INK}"/>`).join('')}
    </g>`,

  'makeup-brushes': () => `
    ${[-1, 0, 1]
      .map(
        (i) => `<g transform="translate(${400 + i * 108} 400) rotate(${i * 7})">
        <rect x="-26" y="-30" width="52" height="250" rx="26" fill="${INK}"/>
        <rect x="-27" y="-70" width="54" height="52" rx="12" fill="${GOLD}"/>
        <path d="M-30 -70 q30 -120 60 0 z" fill="${i === 0 ? '#8C6A5A' : '#A98675'}"/>
      </g>`,
      )
      .join('')}`,

  'makeup-stands': () => `
    <g transform="translate(400 420)">
      <rect x="-190" y="90" width="380" height="34" rx="17" fill="${INK}"/>
      <rect x="-150" y="-140" width="120" height="240" rx="16" fill="${CREAM}" stroke="${TAUPE}" stroke-width="6"/>
      <rect x="30" y="-190" width="120" height="290" rx="16" fill="${CREAM}" stroke="${TAUPE}" stroke-width="6"/>
      ${[0, 1, 2]
        .map((i) => `<rect x="${-130 + i * 30}" y="${-190 - i * 10}" width="16" height="70" rx="8" fill="${GOLD}"/>`)
        .join('')}
      ${[0, 1, 2]
        .map((i) => `<rect x="${50 + i * 30}" y="${-250 + i * 8}" width="16" height="80" rx="8" fill="${INK_SOFT}"/>`)
        .join('')}
    </g>`,

  keychains: () => `
    <g transform="translate(400 360)">
      <circle cx="0" cy="-60" r="86" fill="none" stroke="${GOLD}" stroke-width="20"/>
      <path d="M-52 20 q52 -34 104 0 l24 200 q-76 34 -152 0 z" fill="${WINE}"/>
      <circle cx="0" cy="150" r="26" fill="${CREAM}" opacity="0.8"/>
    </g>`,

  'hair-clips': () => `
    <g transform="translate(400 400) rotate(-12)">
      <rect x="-215" y="-46" width="430" height="92" rx="46" fill="${INK}"/>
      <rect x="-215" y="-46" width="430" height="30" rx="15" fill="#FFFFFF" opacity="0.18"/>
      <circle cx="-120" cy="0" r="22" fill="${GOLD}"/>
      <circle cx="0" cy="0" r="22" fill="${GOLD}" opacity="0.75"/>
      <circle cx="120" cy="0" r="22" fill="${GOLD}" opacity="0.5"/>
    </g>`,

  'hair-clutches': () => `
    <g transform="translate(400 400) rotate(-8)">
      <path d="M-210 -70 h300 a70 70 0 0 1 0 140 h-300 z" fill="${INK}"/>
      ${Array.from({ length: 9 }, (_, i) => `<path d="M${-190 + i * 42} -70 l22 -46 l16 46 z" fill="${INK}"/>`).join('')}
      ${Array.from({ length: 9 }, (_, i) => `<path d="M${-190 + i * 42} 70 l22 46 l16 -46 z" fill="${INK}"/>`).join('')}
      <rect x="-210" y="-24" width="240" height="16" rx="8" fill="#FFFFFF" opacity="0.22"/>
    </g>`,

  scrunchies: () => `
    <g transform="translate(400 400)">
      <path d="M0 -170 C 120 -170 190 -95 190 0 C 190 95 120 170 0 170 C -120 170 -190 95 -190 0 C -190 -95 -120 -170 0 -170 Z"
        fill="none" stroke="${WINE}" stroke-width="86" stroke-linecap="round" opacity="0.9"/>
      <path d="M0 -170 C 120 -170 190 -95 190 0" fill="none" stroke="#FFFFFF" stroke-width="18" opacity="0.28" stroke-linecap="round"/>
      <circle cx="0" cy="0" r="120" fill="none" stroke="${CREAM}" stroke-width="6" opacity="0.5"/>
    </g>`,

  'hair-bands': () => `
    <g transform="translate(400 430)">
      <path d="M-215 90 A 215 215 0 0 1 215 90" fill="none" stroke="${INK}" stroke-width="46" stroke-linecap="round"/>
      <path d="M-215 90 A 215 215 0 0 1 215 90" fill="none" stroke="${GOLD}" stroke-width="10" stroke-linecap="round" opacity="0.6"/>
      <ellipse cx="0" cy="-118" rx="70" ry="46" fill="${WINE}"/>
      <ellipse cx="0" cy="-118" rx="26" ry="18" fill="${CREAM}" opacity="0.7"/>
    </g>`,

  'jewelry-organizers': () => `
    <g transform="translate(400 400)">
      <rect x="-220" y="-120" width="440" height="240" rx="34" fill="${CREAM}" stroke="${TAUPE}" stroke-width="8"/>
      <line x1="-220" y1="0" x2="220" y2="0" stroke="${TAUPE}" stroke-width="6"/>
      <line x1="-73" y1="-120" x2="-73" y2="120" stroke="${TAUPE}" stroke-width="6"/>
      <line x1="73" y1="-120" x2="73" y2="120" stroke="${TAUPE}" stroke-width="6"/>
      <circle cx="-146" cy="-60" r="24" fill="${GOLD}"/>
      <circle cx="0" cy="-60" r="18" fill="${WINE}" opacity="0.7"/>
      <circle cx="146" cy="60" r="22" fill="${GOLD}" opacity="0.7"/>
      <rect x="-40" y="42" width="80" height="36" rx="18" fill="${INK_SOFT}" opacity="0.5"/>
    </g>`,

  'travel-pouches': () => `
    <g transform="translate(400 410)">
      <path d="M-220 -50 q220 -70 440 0 v150 q0 40 -40 40 h-360 q-40 0 -40 -40 z" fill="${WINE}"/>
      <path d="M-220 -50 q220 -70 440 0" fill="none" stroke="${GOLD}" stroke-width="14"/>
      <circle cx="150" cy="-46" r="20" fill="${GOLD}"/>
      <rect x="-60" y="70" width="120" height="14" rx="7" fill="#FFFFFF" opacity="0.3"/>
    </g>`,

  handbags: () => `
    <g transform="translate(400 410)">
      <path d="M-120 -80 a120 120 0 0 1 240 0" fill="none" stroke="${INK_SOFT}" stroke-width="20" stroke-linecap="round"/>
      <path d="M-200 -70 h400 l-32 240 a30 30 0 0 1 -30 26 h-276 a30 30 0 0 1 -30 -26 z" fill="#8A6A55"/>
      <rect x="-46" y="-40" width="92" height="60" rx="12" fill="${GOLD}"/>
      <rect x="-200" y="-70" width="400" height="22" fill="#FFFFFF" opacity="0.16"/>
    </g>`,

  'mens-blazers': () => `
    <g transform="translate(400 400)">
      <path d="M-40 -190 h80 l150 60 l-40 320 h-120 z" fill="${INK}"/>
      <path d="M-40 -190 l-150 60 l40 320 h120 z" fill="${INK}"/>
      <path d="M-40 -190 l40 120 l40 -120 l-14 -8 l-26 44 l-26 -44 z" fill="${CREAM}"/>
      <circle cx="6" cy="120" r="12" fill="${GOLD}"/>
      <circle cx="6" cy="176" r="12" fill="${GOLD}"/>
    </g>`,

  sunglasses: () => `
    <g transform="translate(400 400)">
      <rect x="-250" y="-46" width="150" height="18" rx="9" fill="${INK}" transform="rotate(-16 -175 -37)"/>
      <rect x="100" y="-46" width="150" height="18" rx="9" fill="${INK}" transform="rotate(16 175 -37)"/>
      <rect x="-210" y="-60" width="180" height="130" rx="56" fill="${INK}"/>
      <rect x="30" y="-60" width="180" height="130" rx="56" fill="${INK}"/>
      <rect x="-192" y="-44" width="144" height="98" rx="46" fill="#6E5A52" opacity="0.75"/>
      <rect x="48" y="-44" width="144" height="98" rx="46" fill="#6E5A52" opacity="0.75"/>
      <rect x="-34" y="-30" width="68" height="16" rx="8" fill="${INK}"/>
    </g>`,

  wallets: () => `
    <g transform="translate(400 400) rotate(-6)">
      <rect x="-210" y="-140" width="420" height="280" rx="30" fill="#7A5A47"/>
      <rect x="-210" y="-140" width="420" height="60" rx="30" fill="#FFFFFF" opacity="0.12"/>
      <rect x="-160" y="-70" width="220" height="130" rx="14" fill="${CREAM}" opacity="0.85"/>
      <rect x="-140" y="-40" width="120" height="12" rx="6" fill="${TAUPE}"/>
      <rect x="-140" y="-10" width="80" height="12" rx="6" fill="${TAUPE}"/>
      <rect x="90" y="-24" width="90" height="48" rx="10" fill="${GOLD}"/>
    </g>`,

  belts: () => `
    <g transform="translate(400 400)">
      <path d="M-260 40 q140 -110 300 -20 t220 -30" fill="none" stroke="#7A5A47" stroke-width="66" stroke-linecap="round"/>
      <rect x="-120" y="-70" width="150" height="120" rx="18" fill="none" stroke="${GOLD}" stroke-width="20"/>
      <rect x="-50" y="-30" width="14" height="60" rx="7" fill="${GOLD}"/>
    </g>`,
};

const FALLBACK = () => `
  <g transform="translate(400 400)">
    <circle cx="0" cy="0" r="170" fill="${CREAM}" opacity="0.8"/>
    <path d="M0 -110 C 60 -40 110 -10 110 40 A 110 110 0 0 1 -110 40 C -110 -10 -60 -40 0 -110 Z" fill="${WINE}" opacity="0.8"/>
  </g>`;

/* ------------------------------------------------ decorative page assets */

function heroSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 720" width="1600" height="720" role="img">
  <defs>
    <linearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F6E3DD"/>
      <stop offset="55%" stop-color="#EED3CB"/>
      <stop offset="100%" stop-color="#E3BFB6"/>
    </linearGradient>
    <radialGradient id="hglow" cx="0.72" cy="0.35" r="0.55">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="720" fill="url(#hg)"/>
  <rect width="1600" height="720" fill="url(#hglow)"/>
  <g opacity="0.45" fill="none" stroke="#FFFFFF" stroke-width="2">
    <circle cx="1120" cy="330" r="255"/><circle cx="1120" cy="330" r="185"/>
  </g>
  <!-- Editorial still life: an arch plinth with a few signature pieces. -->
  <g transform="translate(1120 340)">
    <path d="M-215 190 v-150 a215 215 0 0 1 430 0 v150 z" fill="#FBF6F1" opacity="0.85"/>
    <ellipse cx="0" cy="200" rx="300" ry="30" fill="#B98F84" opacity="0.22"/>
    <g transform="translate(-6 -46) rotate(-14)">
      <rect x="-150" y="-30" width="300" height="60" rx="30" fill="#4A3B36"/>
      <rect x="-150" y="-30" width="300" height="20" rx="10" fill="#FFFFFF" opacity="0.18"/>
      <circle cx="-80" cy="0" r="15" fill="#C2954E"/>
      <circle cx="0" cy="0" r="15" fill="#C2954E" opacity="0.72"/>
      <circle cx="80" cy="0" r="15" fill="#C2954E" opacity="0.46"/>
    </g>
    <g transform="translate(-150 96)">
      <path d="M-60 -46 h120 l-12 130 h-96 z" fill="#8A6A55"/>
      <path d="M-36 -46 a36 36 0 0 1 72 0" fill="none" stroke="#6E5A52" stroke-width="11"/>
      <rect x="-16" y="-16" width="32" height="22" rx="6" fill="#C2954E"/>
    </g>
    <g transform="translate(140 108) rotate(8)">
      <rect x="-96" y="-22" width="70" height="10" rx="5" fill="#4A3B36"/>
      <rect x="26" y="-22" width="70" height="10" rx="5" fill="#4A3B36"/>
      <rect x="-86" y="-30" width="86" height="62" rx="27" fill="#4A3B36"/>
      <rect x="0" y="-30" width="86" height="62" rx="27" fill="#4A3B36"/>
      <rect x="-78" y="-22" width="70" height="46" rx="21" fill="#7E6A61" opacity="0.8"/>
      <rect x="8" y="-22" width="70" height="46" rx="21" fill="#7E6A61" opacity="0.8"/>
    </g>
    <g transform="translate(20 92)">
      <rect x="-14" y="-96" width="28" height="130" rx="14" fill="#4A3B36"/>
      <rect x="-15" y="-118" width="30" height="28" rx="8" fill="#C2954E"/>
      <path d="M-17 -118 q17 -70 34 0 z" fill="#A98675"/>
    </g>
  </g>
  <g opacity="0.3">
    <path d="M120 620 q60 -120 150 -60 q-40 90 -150 60 z" fill="#FFFFFF"/>
    <path d="M1470 100 q-70 60 -20 140 q80 -40 20 -140 z" fill="#FFFFFF"/>
  </g>
</svg>
`;
}

function promoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 520" width="1400" height="520" role="img">
  <defs>
    <linearGradient id="pg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#F4E5DC"/><stop offset="100%" stop-color="#E9CFC4"/>
    </linearGradient>
  </defs>
  <rect width="1400" height="520" fill="url(#pg)"/>
  <g transform="translate(1030 270)" opacity="0.95">
    <ellipse cx="0" cy="170" rx="300" ry="36" fill="#B98F84" opacity="0.25"/>
    <g transform="translate(-190 0)"><path d="M-90 -60 h180 l-16 210 h-148 z" fill="#8A6A55"/><path d="M-54 -60 a54 54 0 0 1 108 0" fill="none" stroke="#6E5A52" stroke-width="14"/></g>
    <g transform="translate(40 40) rotate(-12)"><rect x="-140" y="-30" width="280" height="58" rx="29" fill="#4A3B36"/><circle cx="-70" cy="0" r="14" fill="#C2954E"/><circle cx="0" cy="0" r="14" fill="#C2954E" opacity="0.7"/><circle cx="70" cy="0" r="14" fill="#C2954E" opacity="0.45"/></g>
    <g transform="translate(230 20)"><rect x="-20" y="-40" width="40" height="190" rx="20" fill="#4A3B36"/><rect x="-21" y="-72" width="42" height="40" rx="10" fill="#C2954E"/><path d="M-24 -72 q24 -96 48 0 z" fill="#A98675"/></g>
  </g>
  <g opacity="0.3" fill="none" stroke="#FFFFFF" stroke-width="2">
    <circle cx="250" cy="140" r="90"/><circle cx="180" cy="400" r="60"/>
  </g>
</svg>
`;
}

function avatarSvg(name, tone) {
  const letter = name.trim().charAt(0).toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160" role="img">
  <defs><linearGradient id="ag" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${tone[0]}"/><stop offset="100%" stop-color="${tone[1]}"/></linearGradient></defs>
  <rect width="160" height="160" rx="80" fill="url(#ag)"/>
  <text x="80" y="102" text-anchor="middle" font-family="Georgia, serif" font-size="64" fill="#FBF6F1">${letter}</text>
</svg>
`;
}

/* ------------------------------------------------------------------ run */

export function generateProductArt(categorySlug, seed) {
  const draw = art[categorySlug] ?? FALLBACK;
  return svg(draw(), undefined, seed);
}

function write(relPath, contents) {
  const full = join(out, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents, 'utf8');
}

export function generateAll(products) {
  for (const [slug] of Object.entries(art)) {
    write(`categories/${slug}.svg`, generateProductArt(slug, 1));
  }
  for (const product of products) {
    for (let i = 0; i < 3; i += 1) {
      write(`products/${product.slug}-${i + 1}.svg`, generateProductArt(product.category, i + product.seed));
    }
  }
  write('hero/hero-1.svg', heroSvg());
  write('promo/lookbook.svg', promoSvg());
  const avatars = [
    ['Priya Sharma', ['#D9A395', '#B98072']],
    ['Neha Kapoor', ['#C9A7B3', '#A97F8E']],
    ['Ritika Singh', ['#CBB08C', '#A98C66']],
    ['Ananya Iyer', ['#B5A3C4', '#8F7BA3']],
  ];
  for (const [name, tone] of avatars) {
    write(`avatars/${name.toLowerCase().split(' ')[0]}.svg`, avatarSvg(name, tone));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateAll([]);
  console.log('Base artwork written to public/images');
}
