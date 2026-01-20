/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#f6f7fb',
        card: '#ffffff',
        border: '#e6e8ef',
        foreground: '#0f172a',
        muted: '#64748b',
        primary: '#3b82f6'
      },
      borderRadius: {
        lg: '12px',
        md: '10px',
        sm: '8px'
      }
    }
  },
  plugins: []
};
