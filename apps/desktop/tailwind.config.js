/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        navy: {
          DEFAULT: '#0f172a',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617'
        },
        primary: {
          DEFAULT: '#0a7f8b',
          50: '#eaf8fa',
          100: '#d2f0f3',
          200: '#a8e1e7',
          300: '#72cdd6',
          400: '#3ab5c0',
          500: '#14b8c8',
          600: '#0a7f8b',
          700: '#08666f',
          800: '#0b555c',
          900: '#0d474d',
          950: '#052a2e'
        },
        accent: {
          DEFAULT: '#0a7f8b',
          50: '#eaf8fa',
          100: '#d2f0f3',
          200: '#a8e1e7',
          300: '#72cdd6',
          400: '#3ab5c0',
          500: '#14b8c8',
          600: '#0a7f8b',
          700: '#08666f',
          800: '#0b555c',
          900: '#0d474d'
        },
        aqua: {
          50: '#eaf8fa',
          100: '#d2f0f3',
          200: '#a8e1e7',
          300: '#72cdd6',
          400: '#3ab5c0',
          500: '#14b8c8',
          600: '#0a7f8b',
          700: '#08666f'
        },
        brand: {
          50: '#eaf8fa',
          100: '#d2f0f3',
          200: '#a8e1e7',
          300: '#72cdd6',
          400: '#3ab5c0',
          500: '#14b8c8',
          600: '#0a7f8b',
          700: '#08666f',
          800: '#0b555c',
          900: '#0d474d'
        },
        ink: {
          DEFAULT: '#1f2937',
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712'
        },
        canvas: '#f5f6fa',
        line: '#e8ecf3'
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        lg: '0.625rem',
        xl: '0.875rem',
        '2xl': '1.125rem'
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.04), 0 8px 22px -14px rgba(15,23,42,0.18)',
        'card-hover': '0 2px 6px rgba(15,23,42,0.06), 0 18px 36px -18px rgba(15,23,42,0.24)',
        pop: '0 26px 64px -24px rgba(15,23,42,0.32), 0 8px 24px -14px rgba(15,23,42,0.18)',
        soft: '0 12px 30px -18px rgba(15,23,42,0.35)',
        inset: 'inset 0 1px 2px rgba(15,23,42,0.05)',
        focus: '0 0 0 3px rgba(10,127,139,0.18)'
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }]
      },
      keyframes: {
        'fade-in': {
          from: { opacity: 0, transform: 'translateY(4px)' },
          to: { opacity: 1, transform: 'translateY(0)' }
        },
        'scale-in': {
          from: { opacity: 0, transform: 'scale(0.98)' },
          to: { opacity: 1, transform: 'scale(1)' }
        },
        'slide-up': {
          from: { opacity: 0, transform: 'translateY(10px)' },
          to: { opacity: 1, transform: 'translateY(0)' }
        },
        'pulse-soft': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.55 }
        },
        'pop-in': {
          from: { opacity: 0, transform: 'translateY(-6px) scale(0.97)' },
          to: { opacity: 1, transform: 'translateY(0) scale(1)' }
        },
        'ping-slow': {
          '0%': { transform: 'scale(1)', opacity: 0.65 },
          '70%, 100%': { transform: 'scale(2.6)', opacity: 0 }
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        'gradient-pan': {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' }
        },
        'arc-draw': {
          from: { strokeDashoffset: '340' },
          to: { strokeDashoffset: '0' }
        }
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'scale-in': 'scale-in 140ms ease-out',
        'slide-up': 'slide-up 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'pop-in': 'pop-in 180ms cubic-bezier(0.22, 1, 0.36, 1)',
        'ping-slow': 'ping-slow 2.4s cubic-bezier(0, 0, 0.2, 1) infinite',
        'float-slow': 'float-slow 8s ease-in-out infinite',
        'arc-draw': 'arc-draw 1.2s cubic-bezier(0.22, 1, 0.36, 1) both'
      }
    }
  },
  plugins: []
};
