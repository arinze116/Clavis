/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#11130f",
        canvas: "#f3f0e8",
        acid: "#c8ff62",
        moss: "#315b38",
        line: "#d9d5ca",
      },
      boxShadow: {
        lift: "0 24px 80px rgba(17, 19, 15, 0.10)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Georgia", "Times New Roman", "serif"],
        mono: ["SFMono-Regular", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
