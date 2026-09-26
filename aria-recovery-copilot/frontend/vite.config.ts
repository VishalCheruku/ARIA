import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// EMBEDDED MODE (default): the Copilot runs alongside the main ARIA app.
// - Built SPA is served by the FastAPI backend under the base path /copilot/
//   and proxied by the main Express server at the SAME origin:
//   main app :5000/copilot/*  ->  copilot backend :8000/*
// - API calls default to /copilot (see src/api.ts) so they ride the proxy.
//
// STANDALONE MODE: build with COPILOT_BASE=/ VITE_API_BASE= (the copilot
// Dockerfile does exactly this) and the SPA self-hosts at / on its own URL.
// In dev, the /copilot proxy below forwards to the backend on :8000, so the
// main app and the copilot come up together with `npm run dev` in the main
// repo; hot reload still works by visiting /copilot/chat on the Vite server.
export default defineConfig({
  base: process.env.COPILOT_BASE ?? "/copilot/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/copilot": {
        target: process.env.COPILOT_BACKEND_URL || "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/copilot/, ""),
      },
    },
  },
});
