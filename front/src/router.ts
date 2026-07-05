import type { UserDto } from "./api/auth";

export type Screen = "home" | "login" | "register" | "slots" | "create-race" | "create-class" | "game";

type ScreenListener = (screen: Screen) => void;

let currentScreen: Screen = "home";
let activeSlotIndex = 0;
const listeners = new Set<ScreenListener>();

export function getScreen(): Screen {
  return currentScreen;
}

export function getActiveSlot(): number {
  return activeSlotIndex;
}

export interface ActiveCharacterMeta {
  raceId?: string;
  classId?: string;
}

let activeCharacterMeta: ActiveCharacterMeta = {};

export function setActiveCharacterMeta(meta: ActiveCharacterMeta): void {
  activeCharacterMeta = meta;
  persistActiveMeta();
}

export function getActiveCharacterMeta(): ActiveCharacterMeta {
  return activeCharacterMeta;
}

export function setActiveSlot(slotIndex: number): void {
  activeSlotIndex = slotIndex;
  persistActiveSlot();
}

export function navigate(screen: Screen): void {
  if (currentScreen === screen) return;
  currentScreen = screen;
  if (isLoggedIn()) {
    persistScreen(screen);
  }
  listeners.forEach((fn) => fn(screen));
}

export function onScreenChange(listener: ScreenListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const TOKEN_KEY = "skyspire_token";
const USER_KEY = "skyspire_user";
const SCREEN_KEY = "skyspire_screen";
const ACTIVE_SLOT_KEY = "skyspire_active_slot";
const ACTIVE_META_KEY = "skyspire_active_meta";

const LOGGED_IN_SCREENS: Screen[] = ["slots", "create-race", "create-class", "game"];

function persistActiveSlot(): void {
  localStorage.setItem(ACTIVE_SLOT_KEY, String(activeSlotIndex));
}

function persistActiveMeta(): void {
  localStorage.setItem(ACTIVE_META_KEY, JSON.stringify(activeCharacterMeta));
}

function persistScreen(screen: Screen): void {
  localStorage.setItem(SCREEN_KEY, screen);
}

export function saveSession(token: string, user: UserDto): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(SCREEN_KEY);
  localStorage.removeItem(ACTIVE_SLOT_KEY);
  localStorage.removeItem(ACTIVE_META_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): UserDto | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserDto;
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return getToken() !== null;
}

/** Restaura tela e slot salvos após refresh (requer sessão válida). */
export function restoreLoggedInNavigation(): Screen {
  const storedScreen = localStorage.getItem(SCREEN_KEY) as Screen | null;
  const storedSlot = localStorage.getItem(ACTIVE_SLOT_KEY);
  const storedMeta = localStorage.getItem(ACTIVE_META_KEY);

  if (storedSlot !== null) {
    const slotIndex = Number(storedSlot);
    if (!Number.isNaN(slotIndex) && slotIndex >= 0) {
      activeSlotIndex = slotIndex;
    }
  }

  if (storedMeta) {
    try {
      activeCharacterMeta = JSON.parse(storedMeta) as ActiveCharacterMeta;
    } catch {
      activeCharacterMeta = {};
    }
  }

  if (storedScreen && LOGGED_IN_SCREENS.includes(storedScreen)) {
    return storedScreen;
  }

  return "slots";
}
