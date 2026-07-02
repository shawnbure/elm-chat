import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// During local development the React app is served by Vite (HMR) on port 3000,
// while the Cloudflare Worker + Durable Object run under `wrangler dev` on 8787.
// Proxy the API surface (including the room WebSocket) to the Worker so the app
// behaves exactly like production, where a single Worker serves both.
const WORKER_ORIGIN = process.env.WORKER_ORIGIN ?? "http://localhost:8787";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: WORKER_ORIGIN,
        // Keep the original Host header (localhost:3000) so the Worker builds
        // room/invite URLs on the dev-server origin instead of its own :8787.
        changeOrigin: false,
        ws: true
      }
    }
  }
});
