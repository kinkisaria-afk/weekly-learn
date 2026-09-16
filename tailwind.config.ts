import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0b0d10',
          900: '#0f1216',
          850: '#14181d',
          800: '#1a1f26',
          700: '#22272e',
          600: '#2d343d',
        },
        mist: {
          100: '#e6e8eb',
          200: '#c9cfd6',
          300: '#9aa5b1',
          400: '#7c8896',
        },
        accent: {
          DEFAULT: '#7cc4ff',
          soft: '#1e3348',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      maxWidth: {
        content: '72rem',
        prose: '44rem',
      },
    },
  },
  plugins: [],
} satisfies Config;
