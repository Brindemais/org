/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Backed by CSS custom properties (defined in index.css) instead of
        // fixed hex so the internal dashboards (.dashboard-ui, see
        // DashboardShell) can flip to a light theme by re-declaring these
        // variables — every existing bg-ink-*/border-ink-*/text-ink-950
        // class keeps working unchanged, it just resolves to a different
        // color when [data-theme="light"] is set. Public/subscriber pages
        // never set that attribute, so they render identically to before.
        ink: {
          950: 'rgb(var(--ink-950) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
          850: 'rgb(var(--ink-850) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
        },
        gold: {
          50: '#fdf8ec',
          100: '#faedc7',
          200: '#f4da8c',
          300: '#eec253',
          400: '#e6ab2e',
          500: '#d4941e',
          600: '#b87616',
          700: '#935915',
          800: '#794718',
          900: '#673c19',
          DEFAULT: '#d4941e',
        },
        // Semantic surface tokens for the light/public UI (section 2 of the brand brief)
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#faf8f4',
          muted: '#f5f2ec',
        },
        border: {
          DEFAULT: '#e8e4db',
          strong: '#d8d2c4',
        },
        success: {
          50: '#eefbf3',
          100: '#d3f5e0',
          500: '#1f9d5c',
          600: '#187c49',
        },
        danger: {
          50: '#fdeeee',
          100: '#fad6d6',
          500: '#dc3545',
          600: '#b8232f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #f4da8c 0%, #d4941e 45%, #935915 100%)',
        'gold-gradient-soft': 'linear-gradient(135deg, #fdf8ec 0%, #f4da8c 100%)',
        'ink-gradient': 'linear-gradient(180deg, #0e0e11 0%, #08080a 100%)',
      },
      boxShadow: {
        gold: '0 8px 30px -8px rgba(212,148,30,0.45)',
        card: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -12px rgba(0,0,0,0.12)',
        soft: '0 2px 8px -2px rgba(20,20,25,0.06), 0 12px 32px -16px rgba(20,20,25,0.10)',
        popover: '0 12px 40px -8px rgba(20,20,25,0.22)',
      },
      borderRadius: {
        xl2: '1.25rem',
        xl3: '1.75rem',
      },
      spacing: {
        18: '4.5rem',
        safe: 'env(safe-area-inset-bottom)',
      },
      maxWidth: {
        content: '1360px',
      },
    },
  },
  plugins: [],
}
