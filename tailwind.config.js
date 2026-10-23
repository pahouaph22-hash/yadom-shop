/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        jade: { DEFAULT: '#0F4C3A', deep: '#0A3428', soft: '#2E6B57', mist: '#E4EFE9', wash: '#F3F8F5' },
        saffron: { DEFAULT: '#E0A526', deep: '#B9821A', pale: '#FBF1D9' },
        ink: { DEFAULT: '#18231F', soft: '#4A5A53', faint: '#8A9992' },
        indigo: { dye: '#2C3A63' },
        line: '#D5E2DB',
      },
      fontFamily: {
        display: ['"Noto Serif Lao"', '"Noto Serif Thai"', '"Noto Serif"', 'serif'],
        sans: ['"Noto Sans Lao"', '"Noto Sans Thai"', '"Noto Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
