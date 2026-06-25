/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./client/index.html",
    "./client/components/**/*.{js,ts,jsx,tsx}",
    "./client/store/**/*.{js,ts,jsx,tsx}",
    "./client/hooks/**/*.{js,ts,jsx,tsx}",
    "./client/main.tsx",
    "./client/App.tsx",
    "./shared/**/*.ts"
  ],
  theme: {
    extend: {
      colors: {
        catan: {
          lumber: '#1b4332',
          brick: '#9b2226',
          wool: '#70e000',
          grain: '#ffb703',
          ore: '#4a5759',
          paper: '#f4ecd8',
          cloth: '#7209b7',
          coin: '#ffb703',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-active': '0 0 15px rgba(255, 235, 59, 0.8)',
        'glow-red': '0 0 15px rgba(239, 68, 68, 0.8)',
        'glow-blue': '0 0 15px rgba(59, 130, 246, 0.8)',
        'glow-green': '0 0 15px rgba(34, 197, 94, 0.8)',
      }
    },
  },
  plugins: [],
}
