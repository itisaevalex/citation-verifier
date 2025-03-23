/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          50: '#f8f6f1',
          100: '#e5e1d8',
          200: '#d2cec5',
          300: '#bfbab2',
          400: '#aca79f',
          500: '#99938c',
          600: '#867f79',
          700: '#736c66',
          800: '#605953',
          900: '#4d4640',
        },
        ink: {
          DEFAULT: '#2c353d',
          light: '#435165',
        },
      },
      fontFamily: {
        serif: ['Crimson Pro', 'serif'],
      },
    },
  },
  plugins: [],
};