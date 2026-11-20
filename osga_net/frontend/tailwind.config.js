/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        theme: {
          bgDark: "#062F32",
          bgGradient: "#082C35",
          turquoise: "#20B9A9",
          turquoiseHover: "#1AA899",
          mint: "#B8F5E9",
          mintText: "#062F32",
          card: "#F2F4F5",
        },
        navy: {
          950: "#070d19",
          900: "#0b132b",
          850: "#111c3a",
          800: "#1c2541",
          700: "#2d3a66",
        },
        medical: {
          teal: "#0ea5e9",
          cyan: "#06b6d4",
          emerald: "#10b981",
          amber: "#f59e0b",
          rose: "#ef4444",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "Monaco", "Courier New", "monospace"],
      },
    },
  },
  plugins: [],
};
