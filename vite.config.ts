import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

function prepareOfflineAssets(): Plugin {
  return {
    name: "prepare-offline-assets",
    writeBundle(options) {
      const output = path.resolve(options.dir ?? "dist");
      const strayDir = path.join(output, "assets/aistudio");
      if (fs.existsSync(strayDir)) {
        fs.rmSync(strayDir, { recursive: true, force: true });
      }
      // The first visit must cache the code needed to open an island offline.
      const compiled = fs.readdirSync(path.join(output, "assets")).filter(name => /\.(js|css|woff2)$/.test(name)).sort();
      const hash = createHash("sha256").update(compiled.join("\n"));
      for (const page of fs.readdirSync(output).filter(name => name.endsWith(".html")).sort()) {
        hash.update(fs.readFileSync(path.join(output, page)));
      }
      const edition = hash.digest("hex").slice(0, 16);
      const workerPath = path.join(output, "sw.js");
      const worker = fs.readFileSync(workerPath, "utf8")
        .replace('"pixel-civ-shell-dev"', JSON.stringify("pixel-civ-shell-" + edition))
        .replace("/* compiled files */", compiled.filter(name => !/^(romePilot-|pack-|periodArchitecture-)/.test(name)).map(name => JSON.stringify("/assets/" + name)).join(","));
      fs.writeFileSync(workerPath, worker);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), prepareOfflineAssets()],
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
    rolldownOptions: { input: { island: "index.html", guide: "field-guide.html", handbook: "handbook.html", gallery: "gallery.html", downloads: "downloads.html", privacy:"privacy.html", support:"support.html", accountDeletion:"account-deletion.html", periodLibrary:"eras.html", romeReview: "rome-review.html" } },
    emptyOutDir: true,
  },
});
