import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");

function resolveProjectPath(relativePath: string): string | null {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolute = path.resolve(PROJECT_ROOT, normalized);
  if (!absolute.startsWith(PROJECT_ROOT)) return null;
  return absolute;
}

function readBody(req: import("http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res: import("http").ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function isGptImageModel(model: string): boolean {
  return model.startsWith("gpt-image");
}

/** Tamanhos válidos por família de modelo. */
function resolveImageSize(model: string, requested: string): string {
  if (isGptImageModel(model)) {
    const gptSizes = new Set(["1024x1024", "1536x1024", "1024x1536", "auto"]);
    if (gptSizes.has(requested)) return requested;
    // 1792x1024 (dall-e) → landscape mais próximo do gpt-image
    if (requested === "1792x1024") return "1536x1024";
    return "1536x1024";
  }
  return requested;
}

/**
 * Monta payload compatível com a API unificada de imagens.
 * Não envia `response_format` — rejeitado em gpt-image e em dall-e-3 recente.
 */
function buildOpenAiImagePayload(
  model: string,
  prompt: string,
  size: string,
  qualityOverride?: string,
): Record<string, unknown> {
  const resolvedSize = resolveImageSize(model, size);
  const base: Record<string, unknown> = {
    model,
    prompt: prompt.trim(),
    n: 1,
    size: resolvedSize,
  };

  if (isGptImageModel(model)) {
    return {
      ...base,
      quality: qualityOverride ?? "high",
      output_format: "png",
    };
  }

  if (model === "dall-e-3") {
    return {
      ...base,
      quality: qualityOverride ?? "hd",
    };
  }

  return base;
}

async function extractBase64FromOpenAiResponse(
  openaiData: { data?: Array<{ b64_json?: string; url?: string }> },
): Promise<string | null> {
  const item = openaiData.data?.[0];
  if (item?.b64_json) return item.b64_json;
  if (item?.url) {
    const imgRes = await fetch(item.url);
    return Buffer.from(await imgRes.arrayBuffer()).toString("base64");
  }
  return null;
}

async function callOpenAiImageEdit(
  apiKey: string,
  model: string,
  prompt: string,
  referenceAbsolutePath: string,
  quality?: string,
): Promise<{ base64: string; mode: "edit" }> {
  const imageBuffer = fs.readFileSync(referenceAbsolutePath);
  const blob = new Blob([imageBuffer], { type: "image/png" });
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt.trim());
  form.append("image", blob, "reference.png");

  if (isGptImageModel(model)) {
    form.append("quality", quality ?? "high");
    form.append("output_format", "png");
  }

  const openaiRes = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const openaiData = (await openaiRes.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
    error?: { message?: string };
  };

  if (!openaiRes.ok) {
    throw new Error(openaiData.error?.message ?? `OpenAI edit HTTP ${openaiRes.status}`);
  }

  const base64 = await extractBase64FromOpenAiResponse(openaiData);
  if (!base64) throw new Error("OpenAI edit não retornou imagem");
  return { base64, mode: "edit" };
}

async function callOpenAiImageGenerate(
  apiKey: string,
  model: string,
  prompt: string,
  size: string,
  quality?: string,
): Promise<{ base64: string; mode: "generate"; size: string }> {
  const payload = buildOpenAiImagePayload(model, prompt, size, quality);
  const resolvedSize = String(payload.size);

  const openaiRes = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const openaiData = (await openaiRes.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
    error?: { message?: string };
  };

  if (!openaiRes.ok) {
    throw new Error(openaiData.error?.message ?? `OpenAI HTTP ${openaiRes.status}`);
  }

  const base64 = await extractBase64FromOpenAiResponse(openaiData);
  if (!base64) throw new Error("OpenAI não retornou imagem");
  return { base64, mode: "generate", size: resolvedSize };
}

function fileApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: "dev-tools-file-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
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
          try {
            const body = await readBody(req);
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
        }

        if (url.pathname === "/api/write-binary" && req.method === "POST") {
          try {
            const body = await readBody(req);
            const { path: filePath, base64 } = JSON.parse(body) as {
              path?: string;
              base64?: string;
            };
            if (!filePath || !base64) {
              return sendJson(res, 400, { error: "path and base64 required" });
            }

            const absolute = resolveProjectPath(filePath);
            if (!absolute) return sendJson(res, 403, { error: "invalid path" });

            fs.mkdirSync(path.dirname(absolute), { recursive: true });
            fs.writeFileSync(absolute, Buffer.from(base64, "base64"));
            return sendJson(res, 200, { ok: true });
          } catch (err) {
            return sendJson(res, 500, { error: String(err) });
          }
        }

        if (url.pathname === "/api/list-dir" && req.method === "GET") {
          const dirPath = url.searchParams.get("path");
          const ext = url.searchParams.get("ext") ?? "";
          if (!dirPath) return sendJson(res, 400, { error: "path required" });

          const absolute = resolveProjectPath(dirPath);
          if (!absolute) return sendJson(res, 403, { error: "invalid path" });
          if (!fs.existsSync(absolute)) return sendJson(res, 404, { error: "dir not found" });

          try {
            const files = fs
              .readdirSync(absolute)
              .filter((name) => !ext || name.endsWith(ext))
              .sort();
            return sendJson(res, 200, { files });
          } catch (err) {
            return sendJson(res, 500, { error: String(err) });
          }
        }

        if (url.pathname === "/api/ai/env" && req.method === "GET") {
          const apiKey = env.OPENAI_API_KEY?.trim();
          return sendJson(res, 200, {
            configured: Boolean(apiKey),
            model: env.OPENAI_IMAGE_MODEL ?? "gpt-image-1",
            size: env.OPENAI_IMAGE_SIZE ?? "1536x1024",
            quality: env.OPENAI_IMAGE_QUALITY ?? (isGptImageModel(env.OPENAI_IMAGE_MODEL ?? "gpt-image-1") ? "high" : "hd"),
            supportsEdit: isGptImageModel(env.OPENAI_IMAGE_MODEL ?? "gpt-image-1"),
          });
        }

        if (url.pathname === "/api/ai/generate-sprite" && req.method === "POST") {
          const apiKey = env.OPENAI_API_KEY?.trim();
          if (!apiKey) {
            return sendJson(res, 503, {
              error: "OPENAI_API_KEY não configurada. Copie .env.example para .env em tolls/imageMapTools/",
            });
          }

          try {
            const body = await readBody(req);
            const { prompt, referenceAssetPath } = JSON.parse(body) as {
              prompt?: string;
              referenceAssetPath?: string;
            };
            if (!prompt?.trim()) return sendJson(res, 400, { error: "prompt required" });

            const model = env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";
            const size = env.OPENAI_IMAGE_SIZE ?? "1536x1024";
            const quality = env.OPENAI_IMAGE_QUALITY;

            let base64: string;
            let mode: "edit" | "generate" = "generate";
            let resolvedSize = size;

            if (referenceAssetPath) {
              const refAbsolute = resolveProjectPath(referenceAssetPath);
              if (!refAbsolute || !fs.existsSync(refAbsolute)) {
                return sendJson(res, 404, { error: `referência não encontrada: ${referenceAssetPath}` });
              }

              if (!isGptImageModel(model)) {
                return sendJson(res, 400, {
                  error: "Referência visual requer gpt-image-1 (ou gpt-image-*). Ajuste OPENAI_IMAGE_MODEL no .env",
                });
              }

              const editResult = await callOpenAiImageEdit(apiKey, model, prompt, refAbsolute, quality);
              base64 = editResult.base64;
              mode = "edit";
            } else {
              const genResult = await callOpenAiImageGenerate(apiKey, model, prompt, size, quality);
              base64 = genResult.base64;
              mode = "generate";
              resolvedSize = genResult.size;
            }

            const [width, height] = resolvedSize.split("x").map(Number);
            return sendJson(res, 200, { base64, width, height, model, size: resolvedSize, mode });
          } catch (err) {
            return sendJson(res, 500, { error: String(err) });
          }
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");

  return {
    plugins: [fileApiPlugin(env)],
    resolve: {
      alias: {
        "@front": path.resolve(PROJECT_ROOT, "front/src"),
      },
    },
    server: {
      port: 5199,
      open: true,
    },
  };
});
