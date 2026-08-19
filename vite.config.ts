import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Proxies to the local Django backend (SE_automation_server, planning/urls.py)
    // so the browser's requests are same-origin - avoids needing django-cors-headers
    // for local dev. Pair with VITE_API_BASE_URL=/api/planning in .env.
    proxy: {
      "/api/planning": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
