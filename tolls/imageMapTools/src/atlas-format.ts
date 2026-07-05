import type { AtlasData, Frame } from "./types";

/** Serializa o atlas no mesmo formato compacto do projeto (1 frame por linha). */
export function formatAtlasJson(data: AtlasData, frameOrder: string[]): string {
  const names = frameOrder.filter((name) => data.frames[name]);

  for (const name of Object.keys(data.frames)) {
    if (!names.includes(name)) names.push(name);
  }

  const lines = [
    "{",
    `  "sheet": ${JSON.stringify(data.sheet)},`,
    "  \"frames\": {",
  ];

  names.forEach((name, index) => {
    const frame = data.frames[name];
    const comma = index < names.length - 1 ? "," : "";
    lines.push(`    ${JSON.stringify(name)}: ${formatFrame(frame)}${comma}`);
  });

  lines.push("  }");
  lines.push("}");
  return lines.join("\n") + "\n";
}

function formatFrame(frame: Frame): string {
  return `{ "x": ${frame.x}, "y": ${frame.y}, "w": ${frame.w}, "h": ${frame.h} }`;
}

export function extractFrameOrder(raw: string, data: AtlasData): string[] {
  const order: string[] = [];
  const re = /"([^"\\]+)"\s*:\s*\{\s*"x"/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(raw)) !== null) {
    const name = match[1];
    if (data.frames[name] && !order.includes(name)) {
      order.push(name);
    }
  }

  if (order.length === 0) {
    return Object.keys(data.frames);
  }

  for (const name of Object.keys(data.frames)) {
    if (!order.includes(name)) order.push(name);
  }

  return order;
}
