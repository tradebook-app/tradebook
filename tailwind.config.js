/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0D0D11',
          2: '#131318',
          3: '#1A1A24',
          4: '#21212E',
          5: '#282836',
        },
        brd: {
          DEFAULT: '#252530',
          2: '#2E2E3A',
          3: '#383848',
        },
        ac: {
          DEFAULT: '#10B981',
          2: '#34D399',
        },
        red: {
          tb: '#EF4444',
          2: '#F87171',
        },
        blue: {
          tb: '#3B82F6',
        },
        orange: {
          tb: '#F59E0B',
        },
        txt: {
          DEFAULT: '#F1F1F3',
          2: '#9999AA',
          3: '#606070',
          4: '#44444F',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        tb: '8px',
        tb2: '12px',
      },
    },
  },
  plugins: [],
}
