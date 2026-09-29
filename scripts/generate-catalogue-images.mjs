/**
 * Generates placeholder artwork for the REAL Dartler catalogue — the 66 listings
 * in the DARTLER PRODUCTS sheet, grouped into 26 products.
 *
 * Companion to scripts/generate-images.mjs, and deliberately identical in house
 * style: same grounds, same ink/gold/wine palette, same 800x800 frame, same
 * soft drop shadow. Files land in public/images/products/ under the same
 * <slug>-<n>.svg convention the seed and the image importer already use, so
 * replacing one with a studio photograph is a file swap and nothing more.
 *
 *   node scripts/generate-catalogue-images.mjs
 *   node scripts/generate-catalogue-images.mjs --out public/images/products
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argOut = process.argv.indexOf('--out');
const OUT = argOut > -1 ? join(root, process.argv[argOut + 1]) : join(root, 'public', 'images', 'products');

/* ---------------------------------------------------------------- palette */
/* Lifted verbatim from scripts/generate-images.mjs so the two sets sit
   together without a seam. */
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
const GOLD_DEEP = '#9A7233';
const WINE = '#8E2F45';
const CREAM = '#FBF6F1';
const TAUPE = '#C6AF9C';

/** Variant colours, kept muted so they sit inside the brand rather than shout. */
const HUE = {
  blue: '#6E8FB8',
  green: '#7FA87C',
  pink: '#DFA09A',
  purple: '#9C86B8',
  yellow: '#DCB65E',
  red: '#B8524F',
  black: '#2B2825',
  'red heart': '#B8524F',
  'black + red': '#2B2825',
};

const SERIF = "Georgia, 'Times New Roman', 'Playfair Display', serif";

function svg(inner, seed = 0) {
  const [g1, g2] = GROUNDS[seed % GROUNDS.length];
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
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#E4C489"/>
      <stop offset="45%" stop-color="${GOLD}"/>
      <stop offset="100%" stop-color="${GOLD_DEEP}"/>
    </linearGradient>
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

/** The split ring and short chain every keychain hangs from. */
const ring = (x, y, r = 62) => `
  <circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="url(#metal)" stroke-width="17"/>
  <circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#FFFFFF" stroke-width="4" opacity="0.35"
          stroke-dasharray="${r * 1.1} ${r * 5}" transform="rotate(-40 ${x} ${y})"/>
  <rect x="${x - 6}" y="${y + r - 4}" width="12" height="46" rx="6" fill="${GOLD_DEEP}"/>`;

/** The sprung metal clip the flower and fruit designs are mounted on. */
const clipBody = (y = 176) => `
  <g transform="translate(0 ${y})">
    <rect x="-30" y="-8" width="60" height="118" rx="16" fill="url(#metal)"/>
    <rect x="-30" y="-8" width="60" height="40" rx="16" fill="#FFFFFF" opacity="0.22"/>
    <path d="M-52 96 h104 l-16 44 h-72 z" fill="${GOLD_DEEP}"/>
  </g>`;

const butterfly = (x, y, s = 1, fill = CREAM) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <path d="M0 0 C -46 -44 -78 -22 -60 10 C -46 34 -16 26 0 4 Z" fill="${fill}" opacity="0.95"/>
    <path d="M0 0 C 46 -44 78 -22 60 10 C 46 34 16 26 0 4 Z" fill="${fill}" opacity="0.95"/>
    <path d="M0 0 C -34 24 -46 46 -28 56 C -12 64 -2 40 0 16 Z" fill="${fill}" opacity="0.75"/>
    <path d="M0 0 C 34 24 46 46 28 56 C 12 64 2 40 0 16 Z" fill="${fill}" opacity="0.75"/>
    <rect x="-4" y="-8" width="8" height="60" rx="4" fill="${INK}" opacity="0.55"/>
  </g>`;

/* ------------------------------------------------------------------- art */

const art = {
  /** The signature product: a brass fob carrying the customer's initial. */
  letter: (ch) => `
    ${ring(400, 176)}
    <g transform="translate(400 452)">
      <rect x="-152" y="-152" width="304" height="304" rx="34" fill="url(#metal)"/>
      <rect x="-152" y="-152" width="304" height="150" rx="34" fill="#FFFFFF" opacity="0.16"/>
      <rect x="-128" y="-128" width="256" height="256" rx="22" fill="none" stroke="${CREAM}" stroke-width="4" opacity="0.5"/>
      <text x="0" y="0" font-family="${SERIF}" font-size="200" font-weight="700"
            fill="${INK}" text-anchor="middle" dominant-baseline="central">${ch}</text>
    </g>
    <circle cx="566" cy="486" r="17" fill="none" stroke="url(#metal)" stroke-width="8"/>
    ${butterfly(566, 566, 1.5, CREAM)}`,

  /** Chubby Bear doll keychain, one colour per variant. */
  bear: (hue) => `
    ${ring(400, 150, 54)}
    <g transform="translate(400 470)">
      <circle cx="-118" cy="-138" r="56" fill="${hue}"/>
      <circle cx="118" cy="-138" r="56" fill="${hue}"/>
      <circle cx="-118" cy="-138" r="28" fill="${CREAM}" opacity="0.55"/>
      <circle cx="118" cy="-138" r="28" fill="${CREAM}" opacity="0.55"/>
      <ellipse cx="0" cy="30" rx="172" ry="162" fill="${hue}"/>
      <ellipse cx="0" cy="-70" rx="150" ry="130" fill="${hue}"/>
      <ellipse cx="0" cy="-34" rx="74" ry="56" fill="${CREAM}" opacity="0.85"/>
      <circle cx="-54" cy="-96" r="15" fill="${INK}"/>
      <circle cx="54" cy="-96" r="15" fill="${INK}"/>
      <circle cx="-49" cy="-101" r="5" fill="${CREAM}"/>
      <circle cx="59" cy="-101" r="5" fill="${CREAM}"/>
      <ellipse cx="0" cy="-52" rx="18" ry="13" fill="${INK}"/>
      <path d="M-20 -34 q20 20 40 0" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
      <circle cx="-96" cy="34" r="26" fill="${CREAM}" opacity="0.28"/>
      <circle cx="96" cy="34" r="26" fill="${CREAM}" opacity="0.28"/>
    </g>`,

  /** Space Angry Panda — helmet bubble, cross eyebrows. */
  panda: (hue) => `
    ${ring(400, 142, 52)}
    <g transform="translate(400 468)">
      <circle cx="0" cy="-30" r="196" fill="${hue}" opacity="0.25"/>
      <circle cx="0" cy="-30" r="196" fill="none" stroke="${hue}" stroke-width="14"/>
      <circle cx="-72" cy="-146" r="46" fill="${INK}"/>
      <circle cx="72" cy="-146" r="46" fill="${INK}"/>
      <ellipse cx="0" cy="-24" rx="146" ry="134" fill="${CREAM}"/>
      <ellipse cx="-58" cy="-46" rx="42" ry="48" fill="${INK}" transform="rotate(-14 -58 -46)"/>
      <ellipse cx="58" cy="-46" rx="42" ry="48" fill="${INK}" transform="rotate(14 58 -46)"/>
      <circle cx="-56" cy="-44" r="15" fill="${CREAM}"/>
      <circle cx="60" cy="-44" r="15" fill="${CREAM}"/>
      <path d="M-96 -104 l64 26" stroke="${INK}" stroke-width="14" stroke-linecap="round"/>
      <path d="M96 -104 l-64 26" stroke="${INK}" stroke-width="14" stroke-linecap="round"/>
      <ellipse cx="0" cy="18" rx="20" ry="14" fill="${INK}"/>
      <path d="M-26 52 q26 -22 52 0" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
      <circle cx="-124" cy="-150" r="18" fill="${CREAM}" opacity="0.6"/>
    </g>`,

  /** Braided rope keyring — a plait of two cords between two metal ferrules. */
  rope: (a, b) => {
    const strands = Array.from({ length: 11 }, (_, i) => {
      const y = -150 + i * 30;
      const first = i % 2 === 0;
      return `<path d="M${first ? -62 : 62} ${y} Q 0 ${y + 15} ${first ? 62 : -62} ${y + 30}"
                    fill="none" stroke="${first ? a : b}" stroke-width="42"
                    stroke-linecap="round"/>`;
    }).join('');
    return `
    ${ring(400, 148, 52)}
    <g transform="translate(400 470)">
      <path d="M-62 -150 v300" stroke="${a}" stroke-width="42" stroke-linecap="round" opacity="0.35"/>
      <path d="M62 -150 v300" stroke="${b}" stroke-width="42" stroke-linecap="round" opacity="0.35"/>
      ${strands}
      <ellipse cx="0" cy="-166" rx="76" ry="30" fill="url(#metal)"/>
      <ellipse cx="0" cy="166" rx="76" ry="30" fill="url(#metal)"/>
      <ellipse cx="0" cy="-172" rx="76" ry="16" fill="#FFFFFF" opacity="0.22"/>
    </g>`;
  },

  /** Retractable badge reel — body, spool, cord and belt clip. */
  badge: (accent, label) => `
    <g transform="translate(400 330)">
      <circle cx="0" cy="0" r="168" fill="${accent}"/>
      <circle cx="0" cy="0" r="168" fill="none" stroke="#FFFFFF" stroke-width="6" opacity="0.25"/>
      <circle cx="0" cy="0" r="112" fill="${CREAM}" opacity="0.9"/>
      <circle cx="0" cy="0" r="112" fill="none" stroke="${GOLD}" stroke-width="7"/>
      <circle cx="0" cy="0" r="30" fill="url(#metal)"/>
      <text x="0" y="0" font-family="${SERIF}" font-size="0" fill="none">${label}</text>
      <rect x="-52" y="-196" width="104" height="44" rx="16" fill="url(#metal)"/>
    </g>
    <g transform="translate(400 494)">
      <path d="M0 -6 q54 62 -18 116 q-58 44 10 108" fill="none" stroke="${INK_SOFT}"
            stroke-width="16" stroke-linecap="round"/>
      <rect x="-52" y="206" width="104" height="52" rx="14" fill="url(#metal)"/>
      <rect x="-30" y="222" width="60" height="20" rx="10" fill="${INK}" opacity="0.32"/>
    </g>`,

  /** Claw / octopus clip — the workhorse of the hair-clip line. */
  claw: (hue, teeth = 9) => `
    <g transform="translate(400 400) rotate(-6)">
      <path d="M-236 -74 h290 a74 74 0 0 1 0 148 h-290 z" fill="${hue}"/>
      ${Array.from({ length: teeth }, (_, i) =>
        `<path d="M${-214 + i * 46} -74 q14 -62 34 0 z" fill="${hue}"/>`).join('')}
      ${Array.from({ length: teeth }, (_, i) =>
        `<path d="M${-192 + i * 46} 74 q14 62 34 0 z" fill="${hue}"/>`).join('')}
      <rect x="-232" y="-52" width="256" height="18" rx="9" fill="#FFFFFF" opacity="0.26"/>
      <circle cx="72" cy="0" r="24" fill="${GOLD}" opacity="0.6"/>
      <circle cx="-190" cy="0" r="13" fill="${INK}" opacity="0.28"/>
    </g>`,

  /** Barrette — a flat bar with a sprung clasp. */
  barrette: (hue) => `
    <g transform="translate(400 400) rotate(-10)">
      <rect x="-238" y="-52" width="476" height="104" rx="52" fill="${hue}"/>
      <rect x="-238" y="-52" width="476" height="38" rx="19" fill="#FFFFFF" opacity="0.2"/>
      <rect x="-198" y="56" width="396" height="20" rx="10" fill="url(#metal)"/>
      ${[-140, 0, 140].map((x) => `<circle cx="${x}" cy="0" r="24" fill="${GOLD}" opacity="0.7"/>`).join('')}
    </g>`,

  /** Flower clip — five petals and a gold centre. */
  flower: (hue) => `
    <g transform="translate(400 392)">
      ${Array.from({ length: 5 }, (_, i) =>
        `<ellipse cx="0" cy="-118" rx="74" ry="118" fill="${hue}" opacity="0.92"
                  transform="rotate(${i * 72} 0 0)"/>`).join('')}
      <circle cx="0" cy="0" r="58" fill="${GOLD}"/>
      <circle cx="0" cy="0" r="34" fill="${GOLD_DEEP}" opacity="0.55"/>
      ${clipBody(196)}
    </g>`,

  /** Rhinestone clip — a bar set with stones. */
  rhinestone: (hue) => `
    <g transform="translate(400 400) rotate(-8)">
      <rect x="-236" y="-58" width="472" height="116" rx="58" fill="${hue}"/>
      ${Array.from({ length: 9 }, (_, i) => {
        const x = -192 + i * 48;
        return `<circle cx="${x}" cy="0" r="26" fill="${CREAM}" opacity="0.95"/>
                <circle cx="${x - 7}" cy="-8" r="9" fill="#FFFFFF"/>`;
      }).join('')}
      <rect x="-200" y="62" width="400" height="18" rx="9" fill="url(#metal)"/>
    </g>`,

  /** Leopard-print claw — the claw body, spotted. */
  leopard: () => `
    <g transform="translate(400 400) rotate(-6)">
      <path d="M-236 -74 h290 a74 74 0 0 1 0 148 h-290 z" fill="#D9B98A"/>
      ${Array.from({ length: 9 }, (_, i) =>
        `<path d="M${-214 + i * 46} -74 q14 -58 34 0 z" fill="#D9B98A"/>
         <path d="M${-192 + i * 46} 74 q14 58 34 0 z" fill="#D9B98A"/>`).join('')}
      ${[[-176, -20], [-104, 24], [-34, -28], [36, 20], [104, -20], [-140, 30], [-4, 32], [70, -34], [40, -8]]
        .map(([x, y], i) =>
          `<g transform="translate(${x} ${y}) rotate(${i * 37})">
             <ellipse rx="25" ry="18" fill="none" stroke="${INK}" stroke-width="9" stroke-dasharray="28 15"/>
             <ellipse rx="8" ry="6" fill="#8A6032"/>
           </g>`).join('')}
      <rect x="-232" y="-52" width="210" height="16" rx="8" fill="#FFFFFF" opacity="0.22"/>
    </g>`,

  /** Fruit clip — cherry or strawberry. */
  fruit: (kind) => {
    const body = kind === 'cherry'
      ? `<circle cx="-56" cy="60" r="86" fill="#B8323C"/>
         <circle cx="66" cy="92" r="72" fill="#9E2831"/>
         <circle cx="-82" cy="34" r="24" fill="#FFFFFF" opacity="0.34"/>
         <path d="M-56 -26 q28 -128 122 -150" fill="none" stroke="#5C7A45" stroke-width="13" stroke-linecap="round"/>
         <path d="M66 20 q10 -110 100 -196" fill="none" stroke="#5C7A45" stroke-width="13" stroke-linecap="round"/>`
      : `<path d="M0 -40 C 120 -40 156 60 92 152 C 56 202 -56 202 -92 152 C -156 60 -120 -40 0 -40 Z" fill="#C0323B"/>
         ${Array.from({ length: 11 }, (_, i) =>
           `<ellipse cx="${-70 + (i % 4) * 46}" cy="${-4 + Math.floor(i / 4) * 52}" rx="9" ry="13" fill="${GOLD}" opacity="0.85"/>`).join('')}
         <path d="M-84 -50 l40 -46 l30 40 l32 -50 l30 52 l42 -34 l-24 62 z" fill="#5C7A45"/>`;
    return `<g transform="translate(400 360)">${body}
      ${clipBody(214)}
    </g>`;
  },

  /** A multipack — several small keychains laid side by side. */
  pack: (count, hue) => `
    <g transform="translate(400 400)">
      ${Array.from({ length: count }, (_, i) => {
        const x = (i - (count - 1) / 2) * 152;
        const y = (i % 2 === 0 ? -14 : 14);
        return `<g transform="translate(${x} ${y})">
          <circle cx="0" cy="-150" r="34" fill="none" stroke="url(#metal)" stroke-width="11"/>
          <rect x="-6" y="-118" width="12" height="26" rx="6" fill="${GOLD_DEEP}"/>
          <rect x="-56" y="-92" width="112" height="196" rx="26" fill="${hue}" opacity="${0.95 - i * 0.06}"/>
          <rect x="-56" y="-92" width="112" height="76" rx="26" fill="#FFFFFF" opacity="0.18"/>
          <circle cx="0" cy="16" r="26" fill="${CREAM}" opacity="0.4"/>
        </g>`;
      }).join('')}
    </g>`,

  /** Two hearts on one ring — the "Lover Edition" pair. */
  lovers: () => `
    ${ring(400, 158, 54)}
    <g transform="translate(400 468)">
      ${[[-108, WINE], [108, '#DFA09A']].map(([x, fill]) => `
        <g transform="translate(${x} 0)">
          <path d="M0 132 C -140 34 -96 -78 -22 -46 C -8 -40 0 -26 0 -14 C 0 -26 8 -40 22 -46 C 96 -78 140 34 0 132 Z" fill="${fill}"/>
          <circle cx="-38" cy="-8" r="18" fill="#FFFFFF" opacity="0.3"/>
        </g>`).join('')}
    </g>`,

  /** A plain pendant on a ring — the unnamed singles. */
  pendant: (hue) => `
    ${ring(400, 176)}
    <g transform="translate(400 468)">
      <circle cx="0" cy="0" r="152" fill="${hue}"/>
      <circle cx="0" cy="0" r="152" fill="none" stroke="${CREAM}" stroke-width="6" opacity="0.55"/>
      <circle cx="-46" cy="-52" r="34" fill="#FFFFFF" opacity="0.26"/>
      <circle cx="0" cy="0" r="62" fill="url(#metal)" opacity="0.9"/>
    </g>`,
};

/* --------------------------------------------------------------- catalogue */

const slug = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const LETTERS = 'ABCDEFGHIJKLMNOPQRTUVWXYZ'.split(''); // A-Z with no S, per the sheet
const BEAR_COLOURS = ['Blue', 'Green', 'Pink', 'Purple', 'Yellow', 'Red Heart'];
const PANDA_COLOURS = ['Black', 'Blue', 'Green', 'Purple', 'Red', 'Yellow'];
const ROPE = [['Black', '#2B2825', '#4A3B36'], ['Black + Red', '#2B2825', '#B8524F'],
              ['Red', '#B8524F', '#8E2F45'], ['Pink', '#DFA09A', '#CE817B']];
const BADGE = [['Professional Mode', INK], ['Aesthetic Mode', '#9C86B8'], ['Heavy Duty Mode', GOLD_DEEP]];

/** Hair clips: the 18 designs from the sheet, mapped to the nearest shape. */
const CLIPS = [
  ['2026 Trend', 'claw', '#3A3733'],
  ['New Trend 2 Pcs RB', 'claw', '#B8524F'],
  ['Octopus Large pack of 2', 'claw', '#6E5A52'],
  ['Pack of 2 Black', 'claw', '#2B2825'],
  ['Pack of 2 Duple Color', 'claw', '#9C86B8'],
  ['Pack of 3 Barrette', 'barrette', '#8E2F45'],
  ['Pack of 3 Flower', 'flower', '#DFA09A'],
  ['Set of 3 Flower Print', 'flower', '#CE817B'],
  ['Pack of 5 Mixed', 'claw', '#B49B84'],
  ['Pack of 12 Mini Rhinestones', 'rhinestone', '#DFA09A'],
  ['2026 Black and Leopard', 'leopard', null],
  ['Leopard Pattern', 'leopard', null],
  ['Sweet Floral', 'flower', '#EBBDB8'],
  ['Cute Cherry', 'fruit', 'cherry'],
  ['Dual Floral', 'flower', '#9C86B8'],
  ['Geo Rhinestone', 'rhinestone', '#3A3733'],
  ['Strawberry', 'fruit', 'strawberry'],
  ['Extra Large Octopus Claw Clip Glossy Black', 'claw', '#2B2825'],
  ['Extra Large Octopus Claw Clip Purple', 'claw', '#9C86B8'],
];

const files = [];
let seed = 0;
const emit = (name, inner) => {
  files.push([`${name}.svg`, svg(inner, seed++)]);
};

// 1. Initial alphabet keychain — 25 letter variants, three angles each.
LETTERS.forEach((ch) => {
  const base = `initial-alphabet-keychain-${ch.toLowerCase()}`;
  emit(`${base}-1`, art.letter(ch));
  emit(`${base}-2`, art.letter(ch) + `<circle cx="640" cy="180" r="60" fill="${CREAM}" opacity="0.35"/>`);
});

// 2. Chubby Bear — 6 colours.
BEAR_COLOURS.forEach((c) => {
  const base = `chubby-bear-keychain-${slug(c)}`;
  emit(`${base}-1`, art.bear(HUE[c.toLowerCase()] || TAUPE));
  emit(`${base}-2`, art.bear(HUE[c.toLowerCase()] || TAUPE));
});

// 3. Space Angry Panda — 6 colours.
PANDA_COLOURS.forEach((c) => {
  const base = `space-panda-keychain-${slug(c)}`;
  emit(`${base}-1`, art.panda(HUE[c.toLowerCase()] || TAUPE));
  emit(`${base}-2`, art.panda(HUE[c.toLowerCase()] || TAUPE));
});

// 4. Braided rope keychain — 4 colourways.
ROPE.forEach(([name, a, b]) => {
  const base = `braided-rope-keychain-${slug(name)}`;
  emit(`${base}-1`, art.rope(a, b));
  emit(`${base}-2`, art.rope(b, a));
});

// 5. Retractable badge keychain — 3 modes.
BADGE.forEach(([name, accent]) => {
  const base = `retractable-badge-keychain-${slug(name)}`;
  emit(`${base}-1`, art.badge(accent, name));
  emit(`${base}-2`, art.badge(accent, name));
});

// 6. The doll-keychain singles.
emit('doll-keychain-blue-1', art.pendant(HUE.blue));
emit('doll-keychain-blue-2', art.pendant(HUE.blue));
emit('lover-edition-keychain-1', art.lovers());
emit('lover-edition-keychain-2', art.lovers());
emit('simple-keychain-pack-of-4-1', art.pack(4, GOLD));
emit('simple-keychain-pack-of-4-2', art.pack(4, TAUPE));

// 7. Hair clips — 17 designs.
CLIPS.forEach(([name, shape, arg]) => {
  const base = `${slug(name)}`;
  const draw = () =>
    shape === 'claw' ? art.claw(arg)
    : shape === 'barrette' ? art.barrette(arg)
    : shape === 'flower' ? art.flower(arg)
    : shape === 'rhinestone' ? art.rhinestone(arg)
    : shape === 'leopard' ? art.leopard()
    : art.fruit(arg);
  emit(`${base}-1`, draw());
  emit(`${base}-2`, draw());
});

/* ------------------------------------------------------------------ write */

mkdirSync(OUT, { recursive: true });
for (const [name, body] of files) writeFileSync(join(OUT, name), body, 'utf8');

console.log(`Wrote ${files.length} SVG files to ${OUT}`);
console.log('Replace any of them with a photograph of the same name — nothing in the code assumes SVG.');
