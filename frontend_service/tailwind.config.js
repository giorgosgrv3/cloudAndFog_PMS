/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // These link the Tailwind classes to your index.css variables
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        'primary-hover': 'rgb(var(--color-primary-hover) / <alpha-value>)',
        brand: 'rgb(var(--color-brand) / <alpha-value>)',
        
        'bg-main': 'rgb(var(--color-bg-main) / <alpha-value>)',
        'bg-card': 'rgb(var(--color-bg-card) / <alpha-value>)',
        
        'text-main': 'rgb(var(--color-text-main) / <alpha-value>)',
        'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
        'text-on-primary': 'rgb(var(--color-text-on-primary) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}