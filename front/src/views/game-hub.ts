import { fetchCharacterSlots } from "../api/characters";
import { formatApiError } from "../api/auth";
import {
  CLASS_LABELS,
  discardItem,
  equipItem,
  fetchGameState,
  navigateTowerFloor,
  RACE_LABELS,
  repeatTowerFloor,
  unequipItem,
  updateTowerSettings,
  type GameStateResponse,
} from "../api/gameplay";
import { getActiveCharacterMeta, getActiveSlot, getStoredUser, navigate, setActiveCharacterMeta } from "../router";
import { applyGamePatch, initGameCacheFromBootstrap, resetGameCache } from "../state/game-cache";
import { resolveRaceProfile } from "../ui/game-assets";
import {
  bindInventoryPanel,
  computeDisplayStats,
  computeVitalBarPercents,
  renderInventoryPanel,
  type GameTab,
} from "../ui/inventory-panel";
import { renderTowerPanel } from "../ui/tower-panel";
import { bindTowerFloorNav } from "../ui/tower-navigation";
import {
  isTowerCombatLoopRunning,
  runSingleTowerCombat,
  runTowerCombatLoop,
  stopTowerCombatLoop,
} from "../ui/tower-combat-loop";
import { bindTowerSprites, destroyTowerSprites, waitForTowerAnimatorsReady } from "../ui/tower-sprites";
import { canStartTowerCombat } from "../ui/tower-combat";

let cachedState: GameStateResponse | null = null;
let activeTab: GameTab = "inventory";
let selectedInstanceId: string | null = null;
let busy = false;
let towerBindSerial = 0;

export function renderGameHub(root: HTMLElement): void {
  const user = getStoredUser();
  const slotIndex = getActiveSlot();

  root.innerHTML = `
    <div class="game-hub" aria-label="Sky Spire — jogo">
      <aside class="game-sidebar" aria-label="Menu e status">
        <div class="game-sidebar__profile">
          <div class="game-sidebar__avatar-wrap">
            <img id="game-avatar" class="game-sidebar__avatar" alt="" hidden />
            <div id="game-avatar-fallback" class="game-sidebar__avatar-fallback">?</div>
          </div>
          <div class="game-sidebar__identity">
            <strong id="game-username" class="game-sidebar__name">${user?.username ?? "Aventureiro"}</strong>
            <span id="game-class" class="game-sidebar__class">—</span>
            <span id="game-level" class="game-sidebar__level">Nv. —</span>
          </div>
        </div>

        <nav class="game-nav" aria-label="Menus principais">
          <button type="button" class="ui-btn ui-btn--sm ui-btn--active" data-tab="inventory">Inventário</button>
          <button type="button" class="ui-btn ui-btn--sm" data-tab="market">Mercado</button>
          <button type="button" class="ui-btn ui-btn--sm" data-tab="tower">Torre</button>
        </nav>

        <div class="ui-divider" role="presentation"></div>

        <section class="game-tower-summary" aria-label="Torre Infinita">
          <h2 class="game-tower-summary__title">Torre Infinita</h2>
          <p class="game-tower-summary__floor">Andar: <strong id="tower-floor">—</strong></p>
          <label class="game-tower-summary__auto">
            <input id="tower-auto-ascend" class="ui-checkbox" type="checkbox" />
            Subir andar ao desbloquear
          </label>
          <p class="game-tower-summary__unlocked">Desbloqueado até: <span id="tower-unlocked">—</span></p>
          <div class="game-tower-summary__progress">
            <div id="tower-progress-bar" class="game-tower-summary__progress-bar" style="width: 0%"></div>
          </div>
          <p class="game-tower-summary__progress-label">Progresso: <span id="tower-progress-text">0 / 10</span></p>
        </section>

        <section class="game-stats" aria-label="Status do personagem">
          <div class="game-vitals" aria-label="Vida, mana e experiência">
            <div
              class="game-vital-bar game-vital-bar--hp"
              role="progressbar"
              id="bar-hp"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow="0"
              aria-label="HP"
            >
              <div class="game-vital-bar__slot">
                <div class="game-vital-bar__fill" style="width: 0%"></div>
              </div>
              <span class="game-vital-bar__label" id="bar-hp-text">— / —</span>
            </div>
            <div
              class="game-vital-bar game-vital-bar--mp"
              role="progressbar"
              id="bar-mp"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow="0"
              aria-label="MP"
            >
              <div class="game-vital-bar__slot">
                <div class="game-vital-bar__fill" style="width: 0%"></div>
              </div>
              <span class="game-vital-bar__label" id="bar-mp-text">— / —</span>
            </div>
            <div
              class="game-vital-bar game-vital-bar--xp"
              role="progressbar"
              id="bar-xp"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow="0"
              aria-label="XP"
            >
              <div class="game-vital-bar__slot">
                <div class="game-vital-bar__fill" style="width: 0%"></div>
              </div>
              <span class="game-vital-bar__label" id="bar-xp-text">— / —</span>
            </div>
          </div>

          <dl class="game-stats__list">
            <div class="game-stats__row game-stats__row--attack">
              <dt class="game-stats__label">
                <span class="game-stats__icon" aria-hidden="true"></span>
                Ataque
              </dt>
              <dd id="stat-atk">—</dd>
            </div>
            <div class="game-stats__row game-stats__row--defense">
              <dt class="game-stats__label">
                <span class="game-stats__icon" aria-hidden="true"></span>
                Defesa
              </dt>
              <dd id="stat-def">—</dd>
            </div>
            <div class="game-stats__row game-stats__row--gold">
              <dt class="game-stats__label">
                <span class="game-stats__icon" aria-hidden="true"></span>
                Ouro
              </dt>
              <dd id="stat-gold">—</dd>
            </div>
          </dl>
        </section>

        <button type="button" id="game-exit" class="ui-btn ui-btn--ghost ui-btn--sm">Sair para slots</button>
      </aside>

      <main class="game-main" aria-live="polite">
        <div id="game-panel" class="game-panel">
          <p class="game-loading">Carregando personagem…</p>
        </div>
        <p id="game-error" class="auth-error" role="alert" hidden></p>
      </main>
    </div>
  `;

  document.getElementById("game-title")?.setAttribute("hidden", "");
  document.querySelector(".app-main")?.classList.add("app-main--game");
  document.querySelector(".col-12")?.classList.add("col-game-full");

  const panelEl = root.querySelector<HTMLElement>("#game-panel")!;
  const errorEl = root.querySelector<HTMLParagraphElement>("#game-error")!;

  root.querySelector<HTMLButtonElement>("#game-exit")!.addEventListener("click", () => {
    destroyTowerSprites();
    resetGameCache();
    document.getElementById("game-title")?.removeAttribute("hidden");
    document.querySelector(".app-main")?.classList.remove("app-main--game");
    document.querySelector(".col-12")?.classList.remove("col-game-full");
    navigate("slots");
  });

  root.querySelectorAll<HTMLButtonElement>(".game-nav .ui-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextTab = btn.dataset.tab as GameTab;
      if (activeTab === "tower" && nextTab !== "tower") {
        resetTowerCombatUiState();
      }
      activeTab = nextTab;
      root.querySelectorAll(".game-nav .ui-btn").forEach((b) => b.classList.remove("ui-btn--active"));
      btn.classList.add("ui-btn--active");
      renderActivePanel(panelEl);
    });
  });

  root.querySelector<HTMLInputElement>("#tower-auto-ascend")!.addEventListener("change", (e) => {
    void handleAutoAscendChange((e.target as HTMLInputElement).checked, errorEl);
  });

  const meta = getActiveCharacterMeta();
  if (meta.raceId) {
    applyProfileAvatar(root, meta.raceId);
  }

  void loadGame(slotIndex, panelEl, errorEl, root);
}

function applyProfileAvatar(root: HTMLElement, raceId: string): void {
  const raceLabel = RACE_LABELS[raceId] ?? capitalize(raceId);
  const profileUrl = resolveRaceProfile(raceId);
  const avatarImg = root.querySelector<HTMLImageElement>("#game-avatar")!;
  const avatarFallback = root.querySelector<HTMLElement>("#game-avatar-fallback")!;

  avatarImg.src = profileUrl;
  avatarImg.alt = `Retrato — ${raceLabel}`;
  avatarImg.hidden = false;
  avatarFallback.hidden = true;
}

async function loadGame(
  slotIndex: number,
  panelEl: HTMLElement,
  errorEl: HTMLParagraphElement,
  root: HTMLElement,
): Promise<void> {
  errorEl.hidden = true;

  if (!getActiveCharacterMeta().raceId) {
    try {
      const slots = await fetchCharacterSlots();
      const slot = slots.find((s) => s.slotIndex === slotIndex);
      if (slot?.raceId) {
        setActiveCharacterMeta({ raceId: slot.raceId, classId: slot.classId });
        applyProfileAvatar(root, slot.raceId);
      }
    } catch {
      // profile fallback handled below
    }
  }

  try {
    cachedState = initGameCacheFromBootstrap(await fetchGameState(slotIndex));
    updateSidebar(root, cachedState);
    renderActivePanel(panelEl);
  } catch (err) {
    panelEl.innerHTML = "";
    errorEl.textContent = formatApiError(err, "Não foi possível entrar no jogo.");
    errorEl.hidden = false;
  }
}

function updateSidebar(root: HTMLElement, state: GameStateResponse): void {
  const char = state.characterJson;
  const stats = computeDisplayStats(state);
  const vitals = computeVitalBarPercents(state);
  const xpToNext = Math.max(1, char.progression.level * 100);

  const classLabel = CLASS_LABELS[char.classId] ?? capitalize(char.classId);
  const raceLabel = RACE_LABELS[char.raceId] ?? capitalize(char.raceId);

  root.querySelector("#game-class")!.textContent = `${raceLabel} · ${classLabel}`;
  root.querySelector("#game-level")!.textContent = `Nv. ${char.progression.level}`;

  applyProfileAvatar(root, char.raceId);

  updateVitalBar(
    root,
    "#bar-hp",
    vitals.hp,
    stats.hp,
    stats.hp,
    "#bar-hp-text",
  );
  updateVitalBar(
    root,
    "#bar-mp",
    vitals.mp,
    stats.mp,
    stats.mp,
    "#bar-mp-text",
  );
  updateVitalBar(
    root,
    "#bar-xp",
    vitals.xp,
    char.progression.xp,
    xpToNext,
    "#bar-xp-text",
  );

  const tower = char.tower;
  const mobCount = state.currentFloor?.mobCount ?? 10;
  const progress = tower.mobsKilledThisFloor ?? 0;
  const pct = Math.min(100, Math.round((progress / mobCount) * 100));

  root.querySelector("#tower-floor")!.textContent = String(tower.currentFloor);
  root.querySelector<HTMLInputElement>("#tower-auto-ascend")!.checked = tower.autoAscend;
  root.querySelector("#tower-unlocked")!.textContent = String(tower.unlockedFloor);
  root.querySelector<HTMLElement>("#tower-progress-bar")!.style.width = `${pct}%`;
  root.querySelector("#tower-progress-text")!.textContent = `${progress} / ${mobCount}`;

  root.querySelector("#stat-atk")!.textContent = formatNumber(stats.attack);
  root.querySelector("#stat-def")!.textContent = formatNumber(stats.defense);
  root.querySelector("#stat-gold")!.textContent = formatNumber(char.progression.gold);
}

function updateVitalBar(
  root: HTMLElement,
  selector: string,
  percent: number,
  current: number,
  max: number,
  labelSelector: string,
): void {
  const bar = root.querySelector<HTMLElement>(selector)!;
  const fill = bar.querySelector<HTMLElement>(".game-vital-bar__fill")!;
  const label = root.querySelector<HTMLElement>(labelSelector)!;
  const valueText = `${formatNumber(current)} / ${formatNumber(max)}`;

  fill.style.width = `${percent}%`;
  label.textContent = valueText;
  bar.setAttribute("aria-valuenow", String(percent));
  bar.setAttribute("aria-valuetext", valueText);
}

function resetTowerCombatUiState(): void {
  stopTowerCombatLoop();
  destroyTowerSprites();
  busy = false;
}

function renderActivePanel(panelEl: HTMLElement): void {
  if (!cachedState) return;

  if (activeTab !== "tower") {
    resetTowerCombatUiState();
  }

  if (activeTab === "inventory") {
    panelEl.innerHTML = renderInventoryPanel({
      state: cachedState,
      selectedInstanceId,
      busy,
      onSelect: () => {},
      onEquip: () => {},
      onUnequip: () => {},
      onDiscard: () => {},
    });

    bindInventoryPanel(panelEl, {
      state: cachedState,
      selectedInstanceId,
      busy,
      onSelect: (id) => {
        selectedInstanceId = id;
        renderActivePanel(panelEl);
      },
      onEquip: (instanceId) => {
        void handleEquip(instanceId, panelEl);
      },
      onUnequip: (equipSlot) => {
        void handleUnequip(equipSlot, panelEl);
      },
      onDiscard: (instanceId) => {
        void handleDiscard(instanceId, panelEl);
      },
    });
    return;
  }

  if (activeTab === "tower") {
    mountTowerPanel(panelEl, {
      autoStart:
        Boolean(cachedState.characterJson.tower.continuousAttack) &&
        canStartTowerCombat(cachedState) &&
        !isTowerCombatLoopRunning() &&
        !busy,
    });
    return;
  }

  const labels: Record<Exclude<GameTab, "inventory" | "tower">, string> = {
    market: "Mercado",
  };

  panelEl.innerHTML = `
    <div class="game-panel__placeholder">
      <h2 class="game-panel__title">${labels[activeTab]}</h2>
      <p>Em breve — primeiro equipe seu personagem no inventário.</p>
    </div>
  `;
}

async function handleEquip(instanceId: string, panelEl: HTMLElement): Promise<void> {
  if (busy || !cachedState) return;
  busy = true;
  renderActivePanel(panelEl);

  try {
    cachedState = applyGamePatch(cachedState, await equipItem(getActiveSlot(), instanceId));
    selectedInstanceId = instanceId;
    updateSidebar(document.querySelector(".game-hub")!, cachedState);
  } catch (err) {
    showGameError(formatApiError(err, "Falha ao equipar."));
  } finally {
    busy = false;
    renderActivePanel(panelEl);
  }
}

async function handleUnequip(equipSlot: string, panelEl: HTMLElement): Promise<void> {
  if (busy || !cachedState) return;
  busy = true;
  renderActivePanel(panelEl);

  try {
    cachedState = applyGamePatch(cachedState, await unequipItem(getActiveSlot(), equipSlot));
    updateSidebar(document.querySelector(".game-hub")!, cachedState);
  } catch (err) {
    showGameError(formatApiError(err, "Falha ao desequipar."));
  } finally {
    busy = false;
    renderActivePanel(panelEl);
  }
}

async function handleDiscard(instanceId: string, panelEl: HTMLElement): Promise<void> {
  if (busy || !cachedState) return;
  busy = true;
  renderActivePanel(panelEl);

  try {
    cachedState = applyGamePatch(cachedState, await discardItem(getActiveSlot(), instanceId));
    selectedInstanceId = null;
    updateSidebar(document.querySelector(".game-hub")!, cachedState);
  } catch (err) {
    showGameError(formatApiError(err, "Falha ao descartar."));
  } finally {
    busy = false;
    renderActivePanel(panelEl);
  }
}

function mountTowerPanel(panelEl: HTMLElement, options?: { autoStart?: boolean }): void {
  if (!cachedState) return;

  towerBindSerial += 1;
  destroyTowerSprites();
  panelEl.innerHTML = renderTowerPanel({
    state: cachedState,
    username: getStoredUser()?.username ?? "Aventureiro",
  });
  bindTowerSprites(panelEl, cachedState);
  bindTowerCombat(panelEl, options);
  bindTowerFloorNav(panelEl, {
    onNavigate: (direction) => {
      const root = document.querySelector(".game-hub") as HTMLElement | null;
      const errorEl = document.querySelector<HTMLParagraphElement>("#game-error");
      if (root && errorEl) {
        void handleNavigateFloor(direction, panelEl, errorEl);
      }
    },
  });
}

async function handleStartCombat(panelEl: HTMLElement): Promise<void> {
  if (busy || !cachedState) return;

  const btn = panelEl.querySelector<HTMLButtonElement>("#tower-start-combat");
  if (!btn) return;

  if (cachedState.characterJson.tower.continuousAttack) {
    void startContinuousCombat(panelEl);
    return;
  }

  busy = true;
  btn.disabled = true;

  const outcome = await runSingleTowerCombat({
    slotIndex: getActiveSlot(),
    panelEl,
    getState: () => cachedState,
    setState: (state) => {
      cachedState = state;
    },
    onSidebarUpdate: (state) => {
      const root = document.querySelector(".game-hub");
      if (root) updateSidebar(root as HTMLElement, state);
    },
    onStatus: (message) => {
      const statusEl = panelEl.querySelector<HTMLElement>("#tower-combat-status");
      if (statusEl) statusEl.textContent = message;
    },
  });

  if (outcome !== "error") {
    const errorEl = document.querySelector<HTMLParagraphElement>("#game-error");
    if (errorEl) errorEl.hidden = true;
  }

  busy = false;
  renderActivePanel(panelEl);
}

function startContinuousCombat(panelEl: HTMLElement): void {
  if (busy || isTowerCombatLoopRunning() || !cachedState) return;
  if (!cachedState.characterJson.tower.continuousAttack) return;

  busy = true;
  setTowerControlsDisabled(panelEl, true);

  void runTowerCombatLoop({
    slotIndex: getActiveSlot(),
    panelEl,
    getState: () => cachedState,
    setState: (state) => {
      cachedState = state;
    },
    onSidebarUpdate: (state) => {
      const root = document.querySelector(".game-hub");
      if (root) updateSidebar(root as HTMLElement, state);
    },
    onPanelRefresh: () => {
      if (activeTab !== "tower" || !cachedState) return;
      mountTowerPanel(panelEl, { autoStart: false });
      setTowerControlsDisabled(panelEl, true);
    },
    onStatus: (message) => {
      const statusEl = panelEl.querySelector<HTMLElement>("#tower-combat-status");
      if (statusEl) statusEl.textContent = message;
    },
    onError: (message) => {
      showGameError(message);
      if (cachedState) {
        cachedState = {
          ...cachedState,
          characterJson: {
            ...cachedState.characterJson,
            tower: { ...cachedState.characterJson.tower, continuousAttack: false },
          },
        };
      }
      void disableContinuousAttackAfterDefeat(panelEl);
    },
    onFinished: () => {
      busy = false;
      if (activeTab === "tower" && cachedState) {
        mountTowerPanel(panelEl, { autoStart: false });
      }
    },
  });
}

function setTowerControlsDisabled(panelEl: HTMLElement, disabled: boolean): void {
  panelEl.querySelector<HTMLButtonElement>("#tower-start-combat")!.disabled = disabled;
  panelEl.querySelector<HTMLButtonElement>("#tower-floor-up")?.toggleAttribute("disabled", disabled);
  panelEl.querySelector<HTMLButtonElement>("#tower-floor-down")?.toggleAttribute("disabled", disabled);
  panelEl.querySelector<HTMLButtonElement>("#tower-repeat-floor")?.toggleAttribute("disabled", disabled);
}

function bindTowerCombat(panelEl: HTMLElement, options?: { autoStart?: boolean }): void {
  const bindId = towerBindSerial;

  panelEl.querySelector<HTMLButtonElement>("#tower-start-combat")?.addEventListener("click", () => {
    void handleStartCombat(panelEl);
  });
  panelEl.querySelector<HTMLButtonElement>("#tower-repeat-floor")?.addEventListener("click", () => {
    void handleRepeatFloor(panelEl);
  });
  panelEl.querySelector<HTMLInputElement>("#tower-continuous-attack")?.addEventListener("change", (e) => {
    void handleContinuousAttackChange((e.target as HTMLInputElement).checked, panelEl);
  });

  if (options?.autoStart !== true) return;
  if (!cachedState?.characterJson.tower.continuousAttack || !canStartTowerCombat(cachedState)) return;
  if (busy || isTowerCombatLoopRunning()) return;

  void waitForTowerAnimatorsReady().then(() => {
    if (bindId !== towerBindSerial) return;
    if (busy || isTowerCombatLoopRunning() || activeTab !== "tower" || !cachedState) return;
    if (!cachedState.characterJson.tower.continuousAttack || !canStartTowerCombat(cachedState)) return;
    startContinuousCombat(panelEl);
  });
}

async function handleNavigateFloor(
  direction: "up" | "down",
  panelEl: HTMLElement,
  errorEl: HTMLParagraphElement,
): Promise<void> {
  if (busy || !cachedState) return;

  stopTowerCombatLoop();
  busy = true;

  try {
    cachedState = applyGamePatch(cachedState, await navigateTowerFloor(getActiveSlot(), direction));
    errorEl.hidden = true;
    const root = document.querySelector(".game-hub");
    if (root) updateSidebar(root as HTMLElement, cachedState);
    renderActivePanel(panelEl);
  } catch (err) {
    showGameError(formatApiError(err, "Falha ao trocar de andar."));
  } finally {
    busy = false;
  }
}

async function handleRepeatFloor(panelEl: HTMLElement): Promise<void> {
  if (busy || !cachedState) return;

  stopTowerCombatLoop();
  busy = true;
  const errorEl = document.querySelector<HTMLParagraphElement>("#game-error");

  try {
    cachedState = applyGamePatch(cachedState, await repeatTowerFloor(getActiveSlot()));
    if (errorEl) errorEl.hidden = true;
    const root = document.querySelector(".game-hub");
    if (root) updateSidebar(root as HTMLElement, cachedState);
    renderActivePanel(panelEl);
  } catch (err) {
    showGameError(formatApiError(err, "Falha ao repetir o andar."));
  } finally {
    busy = false;
  }
}

async function handleAutoAscendChange(checked: boolean, errorEl: HTMLParagraphElement): Promise<void> {
  if (!cachedState) return;

  try {
    cachedState = applyGamePatch(
      cachedState,
      await updateTowerSettings(getActiveSlot(), {
        autoAscend: checked,
        continuousAttack: cachedState.characterJson.tower.continuousAttack ?? false,
      }),
    );
    errorEl.hidden = true;
  } catch (err) {
    errorEl.textContent = formatApiError(err, "Falha ao salvar preferência.");
    errorEl.hidden = false;
    const root = document.querySelector(".game-hub");
    if (root) {
      root.querySelector<HTMLInputElement>("#tower-auto-ascend")!.checked =
        cachedState.characterJson.tower.autoAscend;
    }
  }
}

async function disableContinuousAttackAfterDefeat(panelEl: HTMLElement): Promise<void> {
  if (!cachedState?.characterJson.tower.continuousAttack) return;

  try {
    cachedState = applyGamePatch(
      cachedState,
      await updateTowerSettings(getActiveSlot(), {
        autoAscend: cachedState.characterJson.tower.autoAscend,
        continuousAttack: false,
      }),
    );
  } catch {
    // keep local stop even if save fails
    cachedState = {
      ...cachedState,
      characterJson: {
        ...cachedState.characterJson,
        tower: { ...cachedState.characterJson.tower, continuousAttack: false },
      },
    };
  }

  const root = document.querySelector(".game-hub");
  if (root) updateSidebar(root as HTMLElement, cachedState);
  renderActivePanel(panelEl);
}

async function handleContinuousAttackChange(checked: boolean, panelEl: HTMLElement): Promise<void> {
  if (!cachedState) return;

  const errorEl = document.querySelector<HTMLParagraphElement>("#game-error");

  if (!checked) {
    stopTowerCombatLoop();
    busy = false;
  }

  try {
    cachedState = applyGamePatch(
      cachedState,
      await updateTowerSettings(getActiveSlot(), {
        autoAscend: cachedState.characterJson.tower.autoAscend,
        continuousAttack: checked,
      }),
    );
    if (errorEl) errorEl.hidden = true;

    if (checked) {
      towerBindSerial += 1;
      startContinuousCombat(panelEl);
    } else {
      renderActivePanel(panelEl);
    }
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = formatApiError(err, "Falha ao salvar ataque contínuo.");
      errorEl.hidden = false;
    }
    const checkbox = panelEl.querySelector<HTMLInputElement>("#tower-continuous-attack");
    if (checkbox) {
      checkbox.checked = cachedState.characterJson.tower.continuousAttack ?? false;
    }
  }
}

function showGameError(message: string): void {
  const errorEl = document.querySelector<HTMLParagraphElement>("#game-error");
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }
}

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
