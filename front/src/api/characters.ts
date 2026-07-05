import { readApiError } from "./errors";
import { getToken } from "../router";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

export interface CharacterSlot {
  slotIndex: number;
  occupied: boolean;
  characterId?: string;
  raceId?: string;
  classId?: string;
  status?: "draft" | "complete";
  characterToken?: string;
  tokenExpiresAt?: string;
  characterJson?: Record<string, unknown>;
}

export interface CharacterActionResponse {
  slot: CharacterSlot;
  characterJson: Record<string, unknown>;
}

function authHeaders(): HeadersInit {
  const token = getToken();
  if (!token) throw new Error("Sessão expirada.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function fetchCharacterSlots(): Promise<CharacterSlot[]> {
  const response = await fetch(`${API_BASE}/characters`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw await readApiError(response, "Falha ao carregar personagens.");
  }

  return (await response.json()) as CharacterSlot[];
}

export async function selectRace(
  slotIndex: number,
  raceId: string,
): Promise<CharacterActionResponse> {
  const response = await fetch(`${API_BASE}/characters/${slotIndex}/race`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ raceId }),
  });

  if (!response.ok) {
    throw await readApiError(response, "Falha ao escolher raça.");
  }

  return (await response.json()) as CharacterActionResponse;
}

export async function selectClass(
  slotIndex: number,
  classId: string,
): Promise<CharacterActionResponse> {
  const response = await fetch(`${API_BASE}/characters/${slotIndex}/class`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ classId }),
  });

  if (!response.ok) {
    throw await readApiError(response, "Falha ao escolher classe.");
  }

  return (await response.json()) as CharacterActionResponse;
}

export async function deleteCharacter(slotIndex: number): Promise<void> {
  const response = await fetch(`${API_BASE}/characters/${slotIndex}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw await readApiError(response, "Falha ao excluir personagem.");
  }
}
