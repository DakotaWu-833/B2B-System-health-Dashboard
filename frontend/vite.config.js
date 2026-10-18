import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const proxy = {
  "/api": { target: process.env.BACKEND_PROXY_TARGET || "http://localhost:8080", changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy,
  },
  preview: { proxy },
  test: {
    environment: "jsdom",
    setupFiles: "./tests/setup.js",
  },
});
