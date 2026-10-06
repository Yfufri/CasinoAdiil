/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        casino: {
          green: '#0d6b3e',
          gold: '#c9a84c',
          red: '#c0392b',
          dark: '#0a0a0f',
          surface: '#12121a',
          border: '#2a2a3a',
        }
      },
      fontFamily: {
        casino: ['"Playfair Display"', 'serif'],
      }
    },
  },
  plugins: [],
}
