import fs from "node:fs";
import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

function resolvePort(customPort?: number): number {
  if (customPort) return customPort;
  const portFlagIdx = process.argv.indexOf("--port");
  if (portFlagIdx !== -1 && process.argv[portFlagIdx + 1]) {
    const parsed = Number(process.argv[portFlagIdx + 1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return Number(process.env.PORT) || 3000;
}

const HOST = "0.0.0.0";

const MIME_BY_EXT: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function tryServeStaticFile(req: IncomingMessage, res: ServerResponse, rootDir: string): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const cleanRel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const resolved = path.resolve(rootDir, cleanRel);
  if (!resolved.startsWith(path.resolve(rootDir))) {
    return false;
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return false;
  }
  const ext = path.extname(resolved).toLowerCase();
  res.statusCode = 200;
  res.setHeader("content-type", MIME_BY_EXT[ext] || "application/octet-stream");
  res.setHeader("x-content-type-options", "nosniff");
  if (ext === ".png" || ext === ".jpg" || ext === ".ico") {
    res.setHeader("cache-control", "public, max-age=3600");
  }
  if (req.method === "HEAD") {
    res.end();
    return true;
  }
  fs.createReadStream(resolved).pipe(res);
  return true;
}

export async function startServer(customPort?: number) {
  const listenPort = resolvePort(customPort);
  const isProd = process.env.NODE_ENV === "production";
  const distDir = path.join(__dirname, "dist");
  const publicDir = path.join(__dirname, "public");
  const useViteDev = !isProd || !fs.existsSync(path.join(distDir, "index.html"));

  const httpServer = http.createServer();

  type ConnectMiddleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
  let viteMiddlewarePromise: Promise<ConnectMiddleware> | null = null;

  if (useViteDev) {
    viteMiddlewarePromise = import("vite").then(async ({ createServer }) => {
      const vite = await createServer({
        root: __dirname,
        server: {
          middlewareMode: true,
          hmr: false,
          allowedHosts: true,
        },
        appType: "spa",
      });
      return vite.middlewares as unknown as ConnectMiddleware;
    });
  }

  httpServer.on("request", async (req: IncomingMessage, res: ServerResponse) => {
    const urlPath = (req.url || "/").split("?")[0];

    if (urlPath === "/api/health") {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: true, app: "Pixel Civilization" }));
      return;
    }

    if (viteMiddlewarePromise) {
      try {
        const viteMiddleware = await viteMiddlewarePromise;
        viteMiddleware(req, res, () => {
          if (!res.headersSent) {
            res.statusCode = 404;
            res.end("Not Found");
          }
        });
      } catch (err) {
        console.error("Vite middleware error:", err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end("Internal Server Error");
        }
      }
      return;
    }

    if (tryServeStaticFile(req, res, distDir)) return;
    if (tryServeStaticFile(req, res, publicDir)) return;

    const indexPath = path.join(distDir, "index.html");
    if (fs.existsSync(indexPath)) {
      res.statusCode = 200;
      res.setHeader("content-type", "text/html; charset=utf-8");
      fs.createReadStream(indexPath).pipe(res);
      return;
    }

    res.statusCode = 404;
    res.end("Not Found");
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(listenPort, HOST, () => {
      console.log(`Pixel Civilization server listening on http://${HOST}:${listenPort}`);
      resolve();
    });
  });

  return {
    httpServer,
    close: () =>
      new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      }),
  };
}

const isMainModule =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(url.fileURLToPath(import.meta.url));

if (isMainModule) {
  void startServer();
}
