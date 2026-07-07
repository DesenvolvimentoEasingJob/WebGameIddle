import { bindAnimMap } from "./anim-map";
import type { AnimMapSource, ResolvedAnimMap } from "./anim-map-types";

import f1SlimeMap from "./maps/f1-slime.anim.json";
import f1BatMap from "./maps/f1-bat.anim.json";
import f1GuardianMap from "./maps/f1-guardian.anim.json";
import elfMageMap from "./maps/elf-mage.anim.json";
import f1WolfMap from "./maps/f1-wolf.anim.json";

import slimeUrl from "../../assets/mobs/f1-slime.png";
import batUrl from "../../assets/mobs/f1-bat.png";
import guardianUrl from "../../assets/mobs/f1-guardian.png";
import elfMageUrl from "../../assets/players/elf-mage.png";
import f1WolfUrl from "../../assets/mobs/f1-wolf.png";

const MOB_ANIM_MAPS: Record<string, ResolvedAnimMap> = {
  "f1-slime": bindAnimMap(f1SlimeMap as AnimMapSource, slimeUrl),
  "f1-bat": bindAnimMap(f1BatMap as AnimMapSource, batUrl),
  "f1-guardian": bindAnimMap(f1GuardianMap as AnimMapSource, guardianUrl),
  "f1-wolf": bindAnimMap(f1WolfMap as AnimMapSource, f1WolfUrl),
};

const PLAYER_ANIM_MAPS: Record<string, ResolvedAnimMap> = {
  "elf-mage": bindAnimMap(elfMageMap as AnimMapSource, elfMageUrl),
};

/** Resolve mapa animado do jogador por raça + classe (ex.: elf-mage). */
export function resolvePlayerAnimMap(raceId: string, classId: string): ResolvedAnimMap | null {
  return PLAYER_ANIM_MAPS[`${raceId}-${classId}`] ?? null;
}

/** Resolve mapa animado do mob pelo id (ex.: f1-slime). */
export function resolveMobAnimMap(mobId: string): ResolvedAnimMap | null {
  return MOB_ANIM_MAPS[mobId] ?? null;
}

export function hasAnimatedSpriteSheet(mobId: string): boolean {
  return mobId in MOB_ANIM_MAPS;
}

/** Todos os mapas registrados — usado pelo Dev Tools (anim-map). */
export function getAllAnimMaps(): ResolvedAnimMap[] {
  return [...Object.values(MOB_ANIM_MAPS), ...Object.values(PLAYER_ANIM_MAPS)];
}

export function getAnimMapById(id: string): ResolvedAnimMap | null {
  return MOB_ANIM_MAPS[id] ?? PLAYER_ANIM_MAPS[id] ?? null;
}

/** @deprecated Use resolveMobAnimMap */
export function resolveMobSpriteSheet(mobId: string): string | null {
  return MOB_ANIM_MAPS[mobId]?.sheetUrl ?? null;
}

/** @deprecated Use resolvePlayerAnimMap */
export function resolvePlayerSpriteSheet(raceId: string, classId: string): string | null {
  return PLAYER_ANIM_MAPS[`${raceId}-${classId}`]?.sheetUrl ?? null;
}
