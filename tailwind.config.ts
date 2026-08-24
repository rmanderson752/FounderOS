import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

/**
 * Founder OS — "Soft Paper" design system
 * Warm off-white canvas, pillowy white cards, generous radii, friendly accents.
 * Legacy scales (blue / gray / emerald / …) are re-pointed at the new palette so
 * existing markup inherits the light theme without a class-by-class rewrite.
 */
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /* ---- Surfaces ---------------------------------------------------- */
        canvas: {
          DEFAULT: '#F7F5F2', // page background — warm off-white
          deep: '#F0ECE6',
          tint: '#FBFAF8',
        },
        surface: {
          DEFAULT: '#FFFFFF', // cards
          2: '#FBFAF8',
          3: '#F3F1EC', // inset / track / subtle fill
          4: '#EAE6DF',
        },
        line: {
          DEFAULT: '#EBE7E0',
          soft: '#F2EFE9',
          strong: '#DCD5CA',
        },

        /* ---- Ink (text) -------------------------------------------------- */
        ink: {
          DEFAULT: '#1B1C1F',
          2: '#3F434B',
          3: '#6B707A',
          4: '#9AA0AB',
          5: '#BCC1CA',
        },

        /* ---- Brand ------------------------------------------------------- */
        brand: {
          50: '#F2F0FF',
          100: '#E6E2FF',
          200: '#D0C9FF',
          300: '#AEA3FF',
          400: '#8B7BF7',
          500: '#6C5CE7',
          600: '#5744C9',
          700: '#48389F',
          800: '#3A2E7E',
          900: '#2E2563',
        },

        /* ---- Legacy scales, re-pointed at the new palette ---------------- */
        // blue == brand (most CTAs in the app are bg-blue-600)
        blue: {
          50: '#F2F0FF', 100: '#E6E2FF', 200: '#D0C9FF', 300: '#6C5CE7',
          400: '#5744C9', 500: '#6C5CE7', 600: '#5B4AD4', 700: '#4A3AAF',
          800: '#3A2E7E', 900: '#2E2563', 950: '#1E1845',
        },
        indigo: {
          50: '#F2F0FF', 100: '#E6E2FF', 200: '#D0C9FF', 300: '#6C5CE7',
          400: '#5744C9', 500: '#6C5CE7', 600: '#5B4AD4', 700: '#4A3AAF',
          800: '#3A2E7E', 900: '#2E2563', 950: '#1E1845',
        },
        violet: {
          50: '#F7F1FF', 100: '#EFE3FF', 200: '#DFC9FF', 300: '#8B5CF6',
          400: '#7A45E8', 500: '#8B5CF6', 600: '#7A45E8', 700: '#6435C4',
          800: '#512B9E', 900: '#40227D', 950: '#2A1654',
        },
        purple: {
          50: '#FAF2FF', 100: '#F3E5FF', 200: '#E7CCFF', 300: '#9B4FD8',
          400: '#8A3FC6', 500: '#A25DDC', 600: '#8A3FC6', 700: '#7233A3',
          800: '#5C2A82', 900: '#482166', 950: '#301446',
        },
        emerald: {
          50: '#ECFBF3', 100: '#D3F5E3', 200: '#A8EAC8', 300: '#0E9C68',
          400: '#0B8A5B', 500: '#12B76A', 600: '#0E9C68', 700: '#0B7A52',
          800: '#095F41', 900: '#074C35', 950: '#032B1E',
        },
        green: {
          50: '#ECFBF3', 100: '#D3F5E3', 200: '#A8EAC8', 300: '#0E9C68',
          400: '#0B8A5B', 500: '#12B76A', 600: '#0E9C68', 700: '#0B7A52',
          800: '#095F41', 900: '#074C35', 950: '#032B1E',
        },
        teal: {
          50: '#EAFAF8', 100: '#CDF2EE', 200: '#9BE5DD', 300: '#0E9384',
          400: '#0B8074', 500: '#14B8A6', 600: '#0E9384', 700: '#0B7367',
          800: '#095A52', 900: '#074842', 950: '#032926',
        },
        amber: {
          50: '#FFF7E8', 100: '#FEEBC6', 200: '#FBD68C', 300: '#A96412',
          400: '#96590F', 500: '#F5A524', 600: '#DC8A0C', 700: '#A96412',
          800: '#7F4C10', 900: '#663D0E', 950: '#3D2408',
        },
        yellow: {
          50: '#FFFAE6', 100: '#FEF1BF', 200: '#FCE187', 300: '#A96412',
          400: '#96590F', 500: '#F5C518', 600: '#DC8A0C', 700: '#A96412',
          800: '#7F4C10', 900: '#663D0E', 950: '#3D2408',
        },
        orange: {
          50: '#FFF4EC', 100: '#FFE5D2', 200: '#FFC7A3', 300: '#B4521A',
          400: '#9E4715', 500: '#FB8232', 600: '#E2661A', 700: '#B4521A',
          800: '#8C4015', 900: '#703411', 950: '#421D09',
        },
        rose: {
          50: '#FFF0F3', 100: '#FFDDE3', 200: '#FFBBC8', 300: '#CE2B4B',
          400: '#B92341', 500: '#F4587A', 600: '#DE3A5F', 700: '#B92341',
          800: '#951C34', 900: '#78182B', 950: '#460D19',
        },
        red: {
          50: '#FFF1F1', 100: '#FFDEDE', 200: '#FFBDBD', 300: '#D02B36',
          400: '#BB232E', 500: '#F04438', 600: '#DB2F26', 700: '#B4241D',
          800: '#911D18', 900: '#761A16', 950: '#450C0A',
        },
        pink: {
          50: '#FFF1F7', 100: '#FFDFEC', 200: '#FFC0DA', 300: '#C42A72',
          400: '#AE2365', 500: '#F4589B', 600: '#DE3A7F', 700: '#C42A72',
          800: '#9C2159', 900: '#7E1B48', 950: '#4A0F2A',
        },
        sky: {
          50: '#EEF7FF', 100: '#D8EDFF', 200: '#B0DAFF', 300: '#1B72C4',
          400: '#1663AC', 500: '#2E90E5', 600: '#1B72C4', 700: '#155C9E',
          800: '#12497D', 900: '#0F3B65', 950: '#08223A',
        },

        /* neutral gray — inverted so dark-theme usage reads on paper */
        gray: {
          50: '#FBFAF8', 100: '#F3F1EC', 200: '#EBE7E0', 300: '#3F434B',
          400: '#6B707A', 500: '#9AA0AB', 600: '#B0B5BE', 700: '#3F434B',
          800: '#2A2C31', 900: '#1B1C1F', 950: '#111214',
        },

        /* named tokens used across the app */
        background: {
          primary: '#F7F5F2',
          secondary: '#FFFFFF',
          card: '#FFFFFF',
          hover: '#F3F1EC',
          active: '#EAE6DF',
        },
        border: {
          subtle: '#F2EFE9',
          default: '#EBE7E0',
        },
        runway: {
          healthy: '#12B76A',
          caution: '#F5A524',
          critical: '#F04438',
        },
        stage: {
          cold: '#9AA0AB',
          warm: '#F5A524',
          hot: '#F04438',
          closed: '#12B76A',
        },
      },

      /* ---- Bubbly geometry ---------------------------------------------- */
      borderRadius: {
        none: '0px',
        sm: '0.5rem',
        DEFAULT: '0.75rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.75rem',
        '4xl': '2.25rem',
        full: '9999px',
      },

      /* ---- Soft, warm elevation ----------------------------------------- */
      boxShadow: {
        xs: '0 1px 2px rgba(28, 25, 23, 0.05)',
        sm: '0 1px 2px rgba(28, 25, 23, 0.05), 0 2px 6px -2px rgba(28, 25, 23, 0.06)',
        DEFAULT: '0 1px 2px rgba(28, 25, 23, 0.05), 0 4px 12px -4px rgba(28, 25, 23, 0.08)',
        md: '0 1px 2px rgba(28, 25, 23, 0.05), 0 6px 16px -6px rgba(28, 25, 23, 0.10)',
        lg: '0 2px 4px rgba(28, 25, 23, 0.04), 0 12px 28px -10px rgba(28, 25, 23, 0.14)',
        xl: '0 4px 8px rgba(28, 25, 23, 0.04), 0 20px 44px -14px rgba(28, 25, 23, 0.18)',
        '2xl': '0 8px 16px rgba(28, 25, 23, 0.05), 0 32px 64px -20px rgba(28, 25, 23, 0.22)',
        inner: 'inset 0 1px 3px rgba(28, 25, 23, 0.06)',
        none: 'none',
        pop: '0 1px 2px rgba(28, 25, 23, 0.06), 0 10px 24px -12px rgba(108, 92, 231, 0.45)',
      },

      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Inter', ...defaultTheme.fontFamily.sans],
        mono: ['var(--font-geist-mono)', 'JetBrains Mono', ...defaultTheme.fontFamily.mono],
      },

      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.34, 1.4, 0.64, 1)',
        'spin-slow': 'spin 2s linear infinite',
        'pop-in': 'popIn 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)',
        float: 'float 7s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.94)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(0,-18px,0) scale(1.04)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
