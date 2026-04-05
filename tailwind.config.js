/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#020617', // Slate-950
        card: '#0f172a',       // Slate-900 (Subtle glass)
        border: 'rgba(51, 65, 85, 0.4)', // Slate-700/40
        primary: '#6366f1',    // Indigo-500
        accent: '#a855f7',     // Purple-500
        muted: '#475569',      // Slate-600
        danger: '#ef4444',     // Red-500
        success: '#10b981',    // Emerald-500
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        heading: ['"Outfit"', 'sans-serif'],
        mono: ['"Geist Mono"', 'monospace'],
      },
      spacing: {
        'workflow-card': '1280px',
        'topbar': '80px',
      },
      borderRadius: {
        'workflow': '2.5rem',
        'terminal': '1.25rem',
      },
      backgroundImage: {
        'workflow-gradient': 'radial-gradient(circle at top center, rgba(99, 102, 241, 0.15), transparent 70%)',
        'terminal-gradient': 'linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(2, 6, 23, 1))',
      },
      animation: {
        'scanline-fast': 'scanline 1.5s linear infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1000%)' },
        },
      }
    },
  },
  plugins: [],
}
