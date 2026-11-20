import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
    hmr: false,
    watch: {
      ignored: ["**/dist/**", "**/.aistudio/**", "**/public/assets/aistudio/**"],
    },
  },
  build: {
    outDir: "dist",
    target: "es2022",
    rolldownOptions: { input: { island: "index.html", guide: "field-guide.html", handbook:"handbook.html" } },
    emptyOutDir: true,
  },
});
