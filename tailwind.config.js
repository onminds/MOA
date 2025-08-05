<<<<<<< HEAD
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
=======
module.exports = {
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
  theme: {
    extend: {
      animation: {
        'slide-in-left': 'slide-in-left 0.3s ease-out',
      },
      keyframes: {
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
<<<<<<< HEAD
  plugins: [],
=======
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
} 