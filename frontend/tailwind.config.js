/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        stellar: {
          50:  "#fafafa",
          100: "#f5f5f5",
          200: "#e5e5e5",
          300: "#d4d4d4",
          400: "#a3a3a3",
          500: "#737373",
          600: "#525252",
          700: "#404040",
          800: "#262626",
          900: "#171717",
          950: "#0a0a0a",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      animation: {
        "pulse-slow":  "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in":     "fadeIn 0.3s ease-in-out",
        "slide-up":    "slideUp 0.3s ease-out",
        "spin-slow":   "spin 3s linear infinite",
        "bounce-ball": "bounceBall 1.4s ease-in-out infinite",
        "typewriter":  "typewriter 2s steps(6, end) forwards",
        "blink":       "blink 0.7s step-end infinite",
        "splash-fade": "splashFade 0.8s ease-out forwards",
        "rise-in":     "riseIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)",    opacity: "1" },
        },
        bounceBall: {
          "0%, 100%": { transform: "translateY(0) scale(1)",    animationTimingFunction: "cubic-bezier(0.8,0,1,1)" },
          "50%":      { transform: "translateY(-28px) scale(0.9)", animationTimingFunction: "cubic-bezier(0,0,0.2,1)" },
        },
        typewriter: {
          "0%":   { width: "0" },
          "100%": { width: "100%" },
        },
        blink: {
          "0%, 100%": { borderColor: "transparent" },
          "50%":      { borderColor: "white" },
        },
        splashFade: {
          "0%":   { opacity: "1", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(1.04)" },
        },
        riseIn: {
          "0%":   { opacity: "0", transform: "translateY(30px) scale(0.8)" },
          "100%": { opacity: "1", transform: "translateY(0)    scale(1)" },
        },
      },
    },
  },
  plugins: [],
};
