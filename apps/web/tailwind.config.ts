import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './modules/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--c-bg)',
        'bg-dark': 'var(--c-bg-dark)',
        green: 'var(--c-green)',
        'green-alt': 'var(--c-green-alt)',
        red: 'var(--c-red)',
        gray: 'var(--c-gray)',
      },
      borderRadius: {
        card: 'var(--radius-card)',
        btn: 'var(--radius-btn)',
      },
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
      },
      fontSize: {
        base: 'var(--font-base)',
      },
      fontFamily: {
        sans: ['var(--font-family-sans)'],
      }
    }
  },
  plugins: []
} satisfies Config; 