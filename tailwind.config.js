/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        body:    ['"DM Sans"', 'sans-serif'],
      },
      // Register CSS-variable colors in the Tailwind palette so that
      // opacity modifiers like bg-surface/90 work correctly (e.g. frosted-glass headers)
      colors: {
        surface: 'rgb(var(--surface) / <alpha-value>)',
        raised:  'rgb(var(--surface-raised) / <alpha-value>)',
        appbg:   'rgb(var(--bg) / <alpha-value>)',
        subtle:  'rgb(var(--bg-subtle) / <alpha-value>)',
        border:  'rgb(var(--border) / <alpha-value>)',
      },
      animation: {
        'slide-up':   'slideUp 0.3s ease-out',
        'fade-in':    'fadeIn 0.2s ease-out',
        'bounce-in':  'bounceIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        'pulse-ring': 'pulseRing 1.5s ease-out infinite',
      },
      keyframes: {
        slideUp: {
          '0%':   { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',     opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        bounceIn: {
          '0%':   { transform: 'scale(0.85)', opacity: '0' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        pulseRing: {
          '0%':   { transform: 'scale(1)',   opacity: '0.4' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
