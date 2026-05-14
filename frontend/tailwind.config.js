/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#D71920',
          blue: '#0076CE',
          cyan: '#00A3E0',
          green: '#78BE20',
        },
        surface: {
          main: '#F5F7FA',
          secondary: '#FFFFFF',
          panel: '#FAFAFA',
          sidebar: '#EEF2F6',
        },
        ink: {
          primary: '#1E1E1E',
          secondary: '#5A5A5A',
          muted: '#7A7A7A',
        },
        line: {
          soft: '#D9E1EA',
          grid: '#E5EAF0',
        },
        status: {
          success: '#2EAF4A',
          warning: '#FF9800',
          error: '#D71920',
          info: '#0076CE',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.06)',
        hover: '0 4px 14px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
};
