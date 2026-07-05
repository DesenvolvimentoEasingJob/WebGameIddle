import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");

function resolveProjectPath(relativePath: string): string | null {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolute = path.resolve(PROJECT_ROOT, normalized);
  if (!absolute.startsWith(PROJECT_ROOT)) return null;
  return absolute;
}

function sendJson(res: import("http").ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function fileApiPlugin(): Plugin {
  return {
    name: "image-map-file-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");

        if (url.pathname === "/api/read-file" && req.method === "GET") {
          const filePath = url.searchParams.get("path");
          if (!filePath) return sendJson(res, 400, { error: "path required" });

          const absolute = resolveProjectPath(filePath);
          if (!absolute) return sendJson(res, 403, { error: "invalid path" });
          if (!fs.existsSync(absolute)) return sendJson(res, 404, { error: "file not found" });

          try {
            const content = fs.readFileSync(absolute, "utf8");
            return sendJson(res, 200, { content });
          } catch (err) {
            return sendJson(res, 500, { error: String(err) });
          }
        }

        if (url.pathname === "/api/write-file" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", () => {
            try {
              const { path: filePath, content } = JSON.parse(body) as {
                path?: string;
                content?: string;
              };
              if (!filePath || content === undefined) {
                return sendJson(res, 400, { error: "path and content required" });
              }

              const absolute = resolveProjectPath(filePath);
              if (!absolute) return sendJson(res, 403, { error: "invalid path" });

              fs.mkdirSync(path.dirname(absolute), { recursive: true });
              fs.writeFileSync(absolute, content, "utf8");
              return sendJson(res, 200, { ok: true });
            } catch (err) {
              return sendJson(res, 500, { error: String(err) });
            }
          });
          return;
        }

        if (url.pathname.startsWith("/project/")) {
          const relative = decodeURIComponent(url.pathname.slice("/project/".length));
          const absolute = resolveProjectPath(relative);
          if (!absolute || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
            res.statusCode = 404;
            res.end("Not found");
            return;
          }

          const ext = path.extname(absolute).toLowerCase();
          const mime: Record<string, string> = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".gif": "image/gif",
            ".json": "application/json",
          };
          res.setHeader("Content-Type", mime[ext] ?? "application/octet-stream");
          fs.createReadStream(absolute).pipe(res);
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [fileApiPlugin()],
  server: {
    port: 5199,
    open: true,
  },
});
