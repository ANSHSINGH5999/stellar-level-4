import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ["buffer", "crypto", "stream", "util", "events", "process", "path", "url", "http", "https"],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor":   ["react", "react-dom"],
          "stellar-vendor": ["@stellar/stellar-sdk"],
          "sentry-vendor":  ["@sentry/react"],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
});
