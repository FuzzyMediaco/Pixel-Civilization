import fs from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function stripUnusedAttachments() {
  return {
    name: "strip-unused-attachments",
    closeBundle() {
      const strayDir = path.resolve("dist/assets/aistudio");
      if (fs.existsSync(strayDir)) {
        fs.rmSync(strayDir, { recursive: true, force: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), stripUnusedAttachments()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
    watch: {
      ignored: ["**/dist/**", "**/.aistudio/**", "**/public/assets/aistudio/**"],
    },
  },
  build: {
    outDir: "dist",
    target: "es2022",
    sourcemap: false,
    rolldownOptions: { input: { island: "index.html", guide: "field-guide.html", handbook: "handbook.html" } },
    emptyOutDir: true,
  },
});
