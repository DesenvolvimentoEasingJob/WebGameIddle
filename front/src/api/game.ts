const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

export interface RaceSummary {
  id: string;
  name: string;
  description?: string;
  assets?: Record<string, string>;
  categories?: Record<string, unknown>;
}

export interface ClassSummary {
  id: string;
  name: string;
  description?: string;
  assets?: Record<string, string>;
  categories?: Record<string, unknown>;
}

export async function fetchRaces(): Promise<RaceSummary[]> {
  const response = await fetch(`${API_BASE}/game/races`);
  if (!response.ok) throw new Error("Falha ao carregar raças.");
  return (await response.json()) as RaceSummary[];
}

export async function fetchClasses(): Promise<ClassSummary[]> {
  const response = await fetch(`${API_BASE}/game/classes`);
  if (!response.ok) throw new Error("Falha ao carregar classes.");
  return (await response.json()) as ClassSummary[];
}
