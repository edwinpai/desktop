import path from "path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;
const port = Number.parseInt(process.env.VITE_PORT || "1420", 10);
const hmrPort = Number.parseInt(process.env.VITE_HMR_PORT || "1421", 10);

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@/components": path.resolve(__dirname, "src/components"),
      "@/lib": path.resolve(__dirname, "src/lib"),
      "@/hooks": path.resolve(__dirname, "src/hooks"),
      "@/stores": path.resolve(__dirname, "src/stores"),
      "@/types": path.resolve(__dirname, "src/types"),
    },
  },
  clearScreen: false,
  server: {
    port,
    strictPort: true,
    host: host || "127.0.0.1",
    hmr:
      host || "127.0.0.1"
        ? {
            protocol: "ws",
            host: host || "127.0.0.1",
            port: hmrPort,
          }
        : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
