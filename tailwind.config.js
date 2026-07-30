/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08080a',
          900: '#0e0e11',
          850: '#151519',
          800: '#1b1b20',
          700: '#26262d',
          600: '#37373f',
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
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #f4da8c 0%, #d4941e 45%, #935915 100%)',
        'ink-gradient': 'linear-gradient(180deg, #0e0e11 0%, #08080a 100%)',
      },
      boxShadow: {
        gold: '0 8px 30px -8px rgba(212,148,30,0.45)',
        card: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -12px rgba(0,0,0,0.12)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
}
