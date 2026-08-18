import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { budgy: { violet: "#8050f2", magenta: "#c347f4", green: "#22c964" } },
      borderRadius: { budgy: "20px" },
    },
  },
  plugins: [],
} satisfies Config;
