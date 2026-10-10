import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      proxy: {
        "/api": {
          target: process.env["VITE_API_URL"] || "http://localhost:3001",
          changeOrigin: true,
        },
        "/ws": {
          target: process.env["VITE_API_URL"] || "http://localhost:3001",
          ws: true,
          changeOrigin: true,
        },
      },
    },
  },
  nitro: { preset: process.env["NITRO_PRESET"] || "vercel" },
  tanstackStart: { server: { entry: "server" } },
});
