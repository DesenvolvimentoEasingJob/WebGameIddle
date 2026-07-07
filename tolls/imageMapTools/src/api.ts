export async function readProjectFile(relativePath: string): Promise<string> {
  const res = await fetch(`/api/read-file?path=${encodeURIComponent(relativePath)}`);
  const data = (await res.json()) as { content?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? "read failed");
  return data.content!;
}

export async function writeProjectFile(relativePath: string, content: string): Promise<void> {
  const res = await fetch("/api/write-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: relativePath, content }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok) throw new Error(data.error ?? "write failed");
}

export function projectFileUrl(relativePath: string): string {
  return `/project/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}

export async function writeBinaryFile(relativePath: string, base64: string): Promise<void> {
  const res = await fetch("/api/write-binary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: relativePath, base64 }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok) throw new Error(data.error ?? "write binary failed");
}

export async function listAnimMapIds(): Promise<string[]> {
  const res = await fetch(
    `/api/list-dir?path=${encodeURIComponent("front/src/animation/maps")}&ext=.anim.json`,
  );
  const data = (await res.json()) as { files?: string[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? "list failed");
  return (data.files ?? []).map((f) => f.replace(/\.anim\.json$/, ""));
}

export interface AiEnvStatus {
  configured: boolean;
  model: string;
  size: string;
  quality?: string;
  supportsEdit?: boolean;
}

export async function checkAiEnv(): Promise<AiEnvStatus> {
  const res = await fetch("/api/ai/env");
  return (await res.json()) as AiEnvStatus;
}

export interface GenerateSpriteResult {
  base64: string;
  width?: number;
  height?: number;
  model?: string;
  size?: string;
  mode?: "edit" | "generate";
}

export async function generateSpriteSheet(
  prompt: string,
  referenceAssetPath?: string,
): Promise<GenerateSpriteResult> {
  const res = await fetch("/api/ai/generate-sprite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, referenceAssetPath }),
  });
  const data = (await res.json()) as GenerateSpriteResult & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "generate failed");
  return data;
}

export async function loadAnimMapSource(id: string): Promise<import("@front/animation/anim-map-types").AnimMapSource> {
  const raw = await readProjectFile(`front/src/animation/maps/${id}.anim.json`);
  return JSON.parse(raw) as import("@front/animation/anim-map-types").AnimMapSource;
}
