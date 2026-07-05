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
