import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    // The Worker (`pnpm dev:api`) serves /api locally on 8787.
    proxy: { "/api": { target: "http://localhost:8787", ws: true } },
  },
});
