import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const frontendRoot = fileURLToPath(new URL(".", import.meta.url));

export function createViteConfig({ mode = "development", envDir = frontendRoot } = {}) {
  // Vite loads .env files after evaluating this config, so proxy settings need loadEnv.
  const env = loadEnv(mode, envDir, "BACKEND_");
  const proxy = {
    "/api": { target: process.env.BACKEND_PROXY_TARGET || env.BACKEND_PROXY_TARGET || "http://localhost:8080", changeOrigin: true },
  };
  return {
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
  };
}

export default defineConfig(({ mode }) => createViteConfig({ mode }));
