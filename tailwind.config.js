/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        ko: ['"Gowun Dodum"', '"Hi Melody"', '"Noto Sans KR"', 'ui-rounded', 'system-ui', 'sans-serif'],
      },
      colors: {
        accent: {
          50: '#fff7ed',
          100: '#ffedd5',
          500: '#f97316',
          600: '#ea580c',
        },
      },
      boxShadow: {
        glow: '0 10px 30px rgba(249, 115, 22, 0.18)',
      },
    },
  },
  plugins: [],
};
