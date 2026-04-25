import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        accent:   "#F5A623",
        positive: "#00C87C",
        negative: "#FF4455",
        warning:  "#F59E0B",
        base:     "#070B12",
      },
      fontFamily: {
        display: ["var(--font-syne)", "sans-serif"],
        mono:    ["var(--font-mono)", "monospace"],
        body:    ["var(--font-body)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
