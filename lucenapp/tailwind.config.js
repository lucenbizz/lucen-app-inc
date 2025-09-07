/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./pages/**/*.{js,jsx,ts,tsx}" // harmless if you don't use /pages
  ],
  theme: {
    extend: {
      colors: {
        brand: "#d4af37", // Lucen gold
      },
    },
  },
  plugins: [],
};
