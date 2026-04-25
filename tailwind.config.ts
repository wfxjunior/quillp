import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ── Quilp Design Tokens ──────────────────────────────────────────
      colors: {
        // ── Shadcn CSS-variable aliases ──────────────────────────────────
        // These map Tailwind utilities (bg-background, text-foreground, etc.)
        // to the CSS vars defined in globals.css. Required by shadcn components.
        background:  'var(--background)',
        foreground:  'var(--foreground)',
        border:      'var(--border)',
        input:       'var(--input)',
        ring:        'var(--ring)',
        primary: {
          DEFAULT:    'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT:    'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT:    'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT:    'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT:    'var(--destructive)',
        },
        card: {
          DEFAULT:    'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT:    'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },

        // ── Quilp Design Tokens ──────────────────────────────────────────
        sage: {
          50:  '#EFF6ED',
          100: '#D5E9D0',
          200: '#B0D4A8',
          400: '#6FA664',  // primary accent
          600: '#3D7234',  // CTA / dark sage
          800: '#1D4018',
        },
        beige: {
          50:  '#FAFAF6',  // page background
          100: '#F4EFE6',
          200: '#E8E0D0',
          300: '#D4C9B8',
          400: '#C4B49A',
          600: '#8A7560',
        },
        ink: {
          DEFAULT: '#1A1916',  // primary text
          mid:     '#5A584F',
          soft:    '#9A9890',
        },
      },

      // ── Typography ───────────────────────────────────────────────────
      fontFamily: {
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
        sans:  ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono:  ['var(--font-jetbrains)', 'JetBrains Mono', 'monospace'],
      },

      // ── Border Radius ────────────────────────────────────────────────
      borderRadius: {
        DEFAULT: '10px',   // --r  (components)
        lg:      '16px',   // --rl (cards)
        xl:      '20px',
        full:    '9999px',
      },

      // ── Box Shadow ───────────────────────────────────────────────────
      boxShadow: {
        card:  '0 1px 3px rgba(26,25,22,0.06), 0 1px 2px rgba(26,25,22,0.04)',
        panel: '0 4px 16px rgba(26,25,22,0.08)',
        modal: '0 20px 60px rgba(26,25,22,0.16)',
      },
    },
  },
  plugins: [],
}

export default config
