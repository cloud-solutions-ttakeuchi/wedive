/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans JP"', 'sans-serif'],
      },
      colors: {
        // Pokemon Zukan Exact Replica Palette
        // Modern Ocean Palette
        gray: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
        ocean: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9', // Primary Brand Color
          600: '#0284C7',
          700: '#0369A1',
          800: '#075985',
          900: '#0C4A6E',
          DEFAULT: '#0EA5E9',
        },
        deepBlue: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          800: '#1e3a8a',
          900: '#0f172a', // Slate 900 for dark text
        },
        // Semantic Colors
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#f8fafc',
          glass: 'rgba(255, 255, 255, 0.7)',
        },
      },
      backgroundImage: {
        'pattern-bubbles': "radial-gradient(#E9ECEF 2px, transparent 2.5px)",
      },
      backgroundSize: {
        'pattern': '20px 20px',
      },
      animation: {
        'bounce-slow': 'bounce 3s infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
