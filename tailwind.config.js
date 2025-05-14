const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Raleway'", ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};
