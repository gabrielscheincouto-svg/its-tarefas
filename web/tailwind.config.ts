import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        its: {
          dark: "#111111",
          darker: "#0A0A0A",
          gray: "#242424",
          grayLight: "#2F2F2F",
          green: "#25EAB4",
          greenHover: "#1DCFA0",
          greenSoft: "#5BCFBA",
          text: "#F7F7F7",
          muted: "#BBBBBB",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
