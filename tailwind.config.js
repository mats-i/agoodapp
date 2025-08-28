/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      borderRadius: {
        '2xl': '1rem',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(15, 23, 42, 0.06), 0 6px 20px rgba(15, 23, 42, 0.06)',
        md: '0 2px 6px rgba(15, 23, 42, 0.08), 0 12px 30px rgba(15, 23, 42, 0.08)',
      },
      colors: {
        accent: {
          DEFAULT: '#3179f6',
          50: '#eef4fe',
          100: '#dbe8fd',
          200: '#b7d1fb',
          300: '#93bbfa',
          400: '#6fa5f8',
          500: '#4b8ef7',
          600: '#3179f6',
          700: '#2a64cc',
          800: '#224fa3',
          900: '#1b3a7a',
        },
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
      },
    },
  },
  plugins: [],
};
