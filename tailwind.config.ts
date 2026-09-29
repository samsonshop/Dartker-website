import type { Config } from 'tailwindcss';

/**
 * Dartler design tokens.
 * Palette taken from the brand reference: warm ivory ground, blush pink,
 * taupe/beige, charcoal, muted gold, and a burgundy/wine primary accent.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: {
          50: '#FFFDFB',
          100: '#FDF9F5',
          200: '#F9F2EB',
          300: '#F3E9DF',
          400: '#EBDDD0',
        },
        blush: {
          50: '#FDF4F3',
          100: '#FAE8E6',
          200: '#F4D5D2',
          300: '#EBBDB8',
          400: '#DFA09A',
          500: '#CE817B',
        },
        taupe: {
          50: '#FAF7F4',
          100: '#F0E9E1',
          200: '#E1D5C8',
          300: '#CDBBA8',
          400: '#B49B84',
          500: '#9A7F67',
          600: '#7C6551',
        },
        charcoal: {
          50: '#F5F5F4',
          100: '#E4E3E1',
          200: '#C0BEBB',
          // Darkened from #8D8A85, which failed WCAG AA for normal text on every
          // surface it is used over (3.03:1 on blush-50, 3.44:1 on white — 4.5 is
          // the floor). `text-charcoal-300` is the app's standard muted-text
          // colour for prices, stock counts and SKUs, so the fix belongs in the
          // token rather than in ~60 call sites. This tone clears 4.5:1 on every
          // surface the design puts it on, blush-100 included (worst case 4.62).
          // Use charcoal-200 for genuinely decorative or disabled text.
          300: '#66625D',
          400: '#5C5854',
          500: '#3A3733',
          600: '#2B2825',
          700: '#211E1C',
          800: '#181615',
          900: '#100F0E',
        },
        gold: {
          50: '#FBF6EC',
          100: '#F4E8D0',
          200: '#E8D0A4',
          300: '#DBB877',
          400: '#CFA254',
          500: '#B9883C',
          600: '#946B2F',
        },
        wine: {
          50: '#FBF2F4',
          100: '#F6E1E6',
          200: '#EBC0CA',
          300: '#DB93A5',
          400: '#C4637C',
          500: '#A83E5B',
          600: '#8E2F45',
          700: '#752739',
          800: '#5C1F2D',
          900: '#431722',
        },
        success: {
          50: '#EFF9F2',
          100: '#D8F0DF',
          500: '#3E9B62',
          600: '#2F7D4D',
        },
        warning: {
          50: '#FDF6EA',
          100: '#F9E9C9',
          500: '#C98A16',
          // Darkened from #A26F10, which gave only 4.06:1 on warning-50 — the
          // "Only N left" stock badge and the admin's low-stock warnings both
          // use this pair. Now 5.30:1 on warning-50 and 5.69:1 on white.
          600: '#8A5E0D',
        },
        danger: {
          50: '#FDF2F2',
          100: '#F9DDDD',
          500: '#C24242',
          600: '#9E3232',
        },
        info: {
          50: '#EFF4FB',
          100: '#D9E4F5',
          500: '#3F6FB5',
          600: '#325891',
        },
      },
      fontFamily: {
        serif: ['var(--font-display)', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        sans: [
          'var(--font-sans)',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(43, 40, 37, 0.04), 0 8px 24px -12px rgba(43, 40, 37, 0.12)',
        'card-hover': '0 2px 6px rgba(43, 40, 37, 0.06), 0 18px 40px -18px rgba(43, 40, 37, 0.22)',
        drawer: '-18px 0 48px -24px rgba(43, 40, 37, 0.35)',
        popover: '0 12px 32px -12px rgba(43, 40, 37, 0.25)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out both',
        'fade-up': 'fade-up 320ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in-right': 'slide-in-right 280ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in-left': 'slide-in-left 280ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-up': 'slide-up 280ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
