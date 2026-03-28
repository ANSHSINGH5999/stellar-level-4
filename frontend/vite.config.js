import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    global: "globalThis",
  },
  resolve: {
    alias: {
      process: "process/browser",
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "ethers-vendor": ["ethers"],
          "sentry-vendor": ["@sentry/react"],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
