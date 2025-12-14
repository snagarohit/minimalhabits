/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // High-contrast habit colors
        habit: {
          red: '#ef4444',
          orange: '#f97316',
          amber: '#f59e0b',
          lime: '#84cc16',
          green: '#22c55e',
          teal: '#14b8a6',
          cyan: '#06b6d4',
          blue: '#3b82f6',
          violet: '#8b5cf6',
          pink: '#ec4899',
        }
      },
      fontFamily: {
        mono: ['SF Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
