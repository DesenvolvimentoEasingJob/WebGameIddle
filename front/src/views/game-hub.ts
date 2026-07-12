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
import {
  pushCombatEvent,
  renderCombatDock,
  renderCombatEventsShell,
  updateCombatDockXp,
} from "../ui/combat-dock";
import { resolveRaceProfile } from "../ui/game-assets";
import {
  bindInventoryPanel,
  computeDisplayStats,
  computeVitalBarPercents,
  renderInventoryPanel,
  type GameTab,
} from "../ui/inventory-panel";
import { renderTowerPanel } from "../ui/tower-panel";
import { renderStatusPanel } from "../ui/status-panel";
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
          <button type="button" class="ui-btn ui-btn--sm" data-tab="status">Status</button>
          <button type="button" class="ui-btn ui-btn--sm" data-tab="market">Mercado</button>
          <button type="button" class="ui-btn ui-btn--sm" data-tab="tower">Torre</button>
        </nav>

        <div class="ui-divider" role="presentation"></div>

        <section class="game-tower-summary" aria-label="Torre Infinita">
          <h2 class="game-tower-summary__title">Torre Infinita</h2>
          <p class="game-tower-summary__floor">Andar: <strong id="tower-floor">—</strong></p>
          <p class="game-tower-summary__unlocked">Desbloqueado até: <span id="tower-unlocked">—</span></p>
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
        <div class="game-workspace">
          <div id="game-panel" class="game-panel">
            <p class="game-loading">Carregando personagem…</p>
          </div>
          <div class="game-combat-strip" aria-label="Combate da Torre Infinita">
            <section id="combat-dock" class="combat-dock" aria-label="Arena de combate"></section>
            <aside id="combat-events" class="combat-events" aria-label="Eventos do combate"></aside>
          </div>
        </div>
        <p id="game-error" class="auth-error" role="alert" hidden></p>
      </main>
    </div>
  `;

  document.getElementById("game-title")?.setAttribute("hidden", "");
  document.querySelector(".app-main")?.classList.add("app-main--game");
  document.querySelector(".col-12")?.classList.add("col-game-full");

  const errorEl = root.querySelector<HTMLParagraphElement>("#game-error")!;

  root.querySelector<HTMLButtonElement>("#game-exit")!.addEventListener("click", () => {
    stopTowerCombatLoop();
    destroyTowerSprites();
    busy = false;
    resetGameCache();
    document.getElementById("game-title")?.removeAttribute("hidden");
    document.querySelector(".app-main")?.classList.remove("app-main--game");
    document.querySelector(".col-12")?.classList.remove("col-game-full");
    navigate("slots");
  });

  root.querySelectorAll<HTMLButtonElement>(".game-nav .ui-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab as GameTab;
      root.querySelectorAll(".game-nav .ui-btn").forEach((b) => b.classList.remove("ui-btn--active"));
      btn.classList.add("ui-btn--active");
      renderActivePanel();
    });
  });

  const meta = getActiveCharacterMeta();
  if (meta.raceId) {
    applyProfileAvatar(root, meta.raceId);
  }

  void loadGame(slotIndex, errorEl, root);
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
    mountCombatDock({ force: true });
    renderActivePanel();
    maybeResumeContinuousCombat();
  } catch (err) {
    getTabPanel().innerHTML = "";
    errorEl.textContent = formatApiError(err, "Não foi possível entrar no jogo.");
    errorEl.hidden = false;
  }
}

function getTabPanel(): HTMLElement {
  return document.querySelector<HTMLElement>("#game-panel")!;
}

function getCombatDock(): HTMLElement {
  return document.querySelector<HTMLElement>("#combat-dock")!;
}

function getCombatEvents(): HTMLElement {
  return document.querySelector<HTMLElement>("#combat-events")!;
}

/** Raiz que contém arena (dock) + controles da aba Torre. */
function getCombatRoot(): HTMLElement {
  return document.querySelector<HTMLElement>(".game-main")!;
}

function isTowerControlsMounted(): boolean {
  return getTabPanel().querySelector(".tower-layout") != null;
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

  updateVitalBar(root, "#bar-hp", vitals.hp, stats.hp, stats.hp, "#bar-hp-text");
  updateVitalBar(root, "#bar-mp", vitals.mp, stats.mp, stats.mp, "#bar-mp-text");
  updateVitalBar(root, "#bar-xp", vitals.xp, char.progression.xp, xpToNext, "#bar-xp-text");

  const tower = char.tower;

  root.querySelector("#tower-floor")!.textContent = String(tower.currentFloor);
  root.querySelector("#tower-unlocked")!.textContent = String(tower.unlockedFloor);

  root.querySelector("#stat-atk")!.textContent = formatNumber(stats.attack);
  root.querySelector("#stat-def")!.textContent = formatNumber(stats.defense);
  root.querySelector("#stat-gold")!.textContent = formatNumber(char.progression.gold);

  updateCombatDockXp(state);
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

function publishCombatStatus(message: string): void {
  const statusEl = document.querySelector<HTMLElement>("#tower-combat-status");
  if (statusEl) statusEl.textContent = message;
  pushCombatEvent(message);
}

function mountCombatDock(options?: { force?: boolean }): void {
  if (!cachedState) return;

  const dock = getCombatDock();
  const events = getCombatEvents();

  // Dock é persistente entre abas; só remonta com force (troca de andar, fim de luta, etc.).
  if (
    dock.querySelector(".tower-arena, .combat-dock__empty") != null &&
    options?.force !== true
  ) {
    return;
  }

  destroyTowerSprites();
  dock.innerHTML = renderCombatDock({
    state: cachedState,
    username: getStoredUser()?.username ?? "Aventureiro",
  });
  if (!events.querySelector("#combat-events-list")) {
    events.innerHTML = renderCombatEventsShell();
  }
  bindTowerSprites(dock, cachedState);
}

function renderActivePanel(options?: { forceTowerRemount?: boolean; forceDockRemount?: boolean }): void {
  if (!cachedState) return;

  if (options?.forceDockRemount) {
    mountCombatDock({ force: true });
  } else {
    mountCombatDock();
  }

  const panel = getTabPanel();

  if (activeTab === "inventory") {
    panel.innerHTML = renderInventoryPanel({
      state: cachedState,
      selectedInstanceId,
      busy,
      onSelect: () => {},
      onEquip: () => {},
      onUnequip: () => {},
      onDiscard: () => {},
    });

    bindInventoryPanel(panel, {
      state: cachedState,
      selectedInstanceId,
      busy,
      onSelect: (id) => {
        selectedInstanceId = id;
        renderActivePanel();
      },
      onEquip: (instanceId) => {
        void handleEquip(instanceId);
      },
      onUnequip: (equipSlot) => {
        void handleUnequip(equipSlot);
      },
      onDiscard: (instanceId) => {
        void handleDiscard(instanceId);
      },
    });
    return;
  }

  if (activeTab === "tower") {
    mountTowerControls({
      force: options?.forceTowerRemount === true,
      autoStart:
        Boolean(cachedState.characterJson.tower.continuousAttack) &&
        canStartTowerCombat(cachedState) &&
        !isTowerCombatLoopRunning() &&
        !busy,
    });
    return;
  }

  if (activeTab === "status") {
    panel.innerHTML = renderStatusPanel({
      state: cachedState,
      username: getStoredUser()?.username ?? "Aventureiro",
    });
    return;
  }

  panel.innerHTML = `
    <div class="game-panel__placeholder">
      <h2 class="game-panel__title">Mercado</h2>
      <p>Em breve — o combate da torre continua no painel inferior.</p>
    </div>
  `;
}

async function handleEquip(instanceId: string): Promise<void> {
  if (busy || !cachedState) return;
  busy = true;
  renderActivePanel();

  try {
    cachedState = applyGamePatch(cachedState, await equipItem(getActiveSlot(), instanceId));
    selectedInstanceId = instanceId;
    updateSidebar(document.querySelector(".game-hub")!, cachedState);
  } catch (err) {
    showGameError(formatApiError(err, "Falha ao equipar."));
  } finally {
    busy = false;
    renderActivePanel();
  }
}

async function handleUnequip(equipSlot: string): Promise<void> {
  if (busy || !cachedState) return;
  busy = true;
  renderActivePanel();

  try {
    cachedState = applyGamePatch(cachedState, await unequipItem(getActiveSlot(), equipSlot));
    updateSidebar(document.querySelector(".game-hub")!, cachedState);
  } catch (err) {
    showGameError(formatApiError(err, "Falha ao desequipar."));
  } finally {
    busy = false;
    renderActivePanel();
  }
}

async function handleDiscard(instanceId: string): Promise<void> {
  if (busy || !cachedState) return;
  busy = true;
  renderActivePanel();

  try {
    cachedState = applyGamePatch(cachedState, await discardItem(getActiveSlot(), instanceId));
    selectedInstanceId = null;
    updateSidebar(document.querySelector(".game-hub")!, cachedState);
  } catch (err) {
    showGameError(formatApiError(err, "Falha ao descartar."));
  } finally {
    busy = false;
    renderActivePanel();
  }
}

function mountTowerControls(options?: { autoStart?: boolean; force?: boolean }): void {
  if (!cachedState) return;

  if (isTowerControlsMounted() && isTowerCombatLoopRunning() && options?.force !== true) {
    setTowerControlsDisabled(getTabPanel(), true);
    return;
  }

  const panel = getTabPanel();
  towerBindSerial += 1;
  panel.innerHTML = renderTowerPanel({
    state: cachedState,
    username: getStoredUser()?.username ?? "Aventureiro",
  });
  bindTowerCombat(panel, options);
  bindTowerFloorNav(panel, {
    onNavigate: (direction) => {
      const errorEl = document.querySelector<HTMLParagraphElement>("#game-error");
      if (errorEl) void handleNavigateFloor(direction, errorEl);
    },
  });

  if (isTowerCombatLoopRunning()) {
    setTowerControlsDisabled(panel, true);
  }
}

async function handleStartCombat(): Promise<void> {
  if (busy || !cachedState) return;

  const controls = getTabPanel();
  const btn = controls.querySelector<HTMLButtonElement>("#tower-start-combat");
  if (!btn) return;

  if (cachedState.characterJson.tower.continuousAttack) {
    void startContinuousCombat();
    return;
  }

  busy = true;
  btn.disabled = true;
  mountCombatDock();

  const outcome = await runSingleTowerCombat({
    slotIndex: getActiveSlot(),
    panelEl: getCombatRoot(),
    getState: () => cachedState,
    setState: (state) => {
      cachedState = state;
    },
    onSidebarUpdate: (state) => {
      const root = document.querySelector(".game-hub");
      if (root) updateSidebar(root as HTMLElement, state);
    },
    onStatus: publishCombatStatus,
  });

  if (outcome !== "error") {
    const errorEl = document.querySelector<HTMLParagraphElement>("#game-error");
    if (errorEl) errorEl.hidden = true;
  }

  busy = false;
  renderActivePanel({ forceTowerRemount: true, forceDockRemount: true });
}

function maybeResumeContinuousCombat(): void {
  if (!cachedState?.characterJson.tower.continuousAttack) return;
  if (!canStartTowerCombat(cachedState)) return;
  if (isTowerCombatLoopRunning()) return;
  startContinuousCombat();
}

function startContinuousCombat(): void {
  if (isTowerCombatLoopRunning() || !cachedState) return;
  if (!cachedState.characterJson.tower.continuousAttack) return;
  if (!canStartTowerCombat(cachedState)) return;

  mountCombatDock();
  if (activeTab === "tower") {
    mountTowerControls({ autoStart: false });
    setTowerControlsDisabled(getTabPanel(), true);
  }

  const root = getCombatRoot();

  void runTowerCombatLoop({
    slotIndex: getActiveSlot(),
    panelEl: root,
    getState: () => cachedState,
    setState: (state) => {
      cachedState = state;
    },
    onSidebarUpdate: (state) => {
      const hub = document.querySelector(".game-hub");
      if (hub) updateSidebar(hub as HTMLElement, state);
    },
    onPanelRefresh: () => {
      if (!cachedState) return;
      mountCombatDock({ force: true });
      if (activeTab === "tower") {
        mountTowerControls({ force: true, autoStart: false });
        setTowerControlsDisabled(getTabPanel(), true);
      }
    },
    onStatus: publishCombatStatus,
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
      void disableContinuousAttackAfterDefeat();
    },
    onFinished: () => {
      if (!cachedState) return;
      mountCombatDock({ force: true });
      if (activeTab === "tower") {
        mountTowerControls({ force: true, autoStart: false });
      }
    },
  });
}

function setTowerControlsDisabled(panelEl: HTMLElement, disabled: boolean): void {
  const combatBtn = panelEl.querySelector<HTMLButtonElement>("#tower-start-combat");
  if (combatBtn) combatBtn.disabled = disabled;
  panelEl.querySelector<HTMLButtonElement>("#tower-floor-up")?.toggleAttribute("disabled", disabled);
  panelEl.querySelector<HTMLButtonElement>("#tower-floor-down")?.toggleAttribute("disabled", disabled);
  panelEl.querySelector<HTMLButtonElement>("#tower-repeat-floor")?.toggleAttribute("disabled", disabled);
}

function bindTowerCombat(panelEl: HTMLElement, options?: { autoStart?: boolean }): void {
  const bindId = towerBindSerial;

  panelEl.querySelector<HTMLButtonElement>("#tower-start-combat")?.addEventListener("click", () => {
    void handleStartCombat();
  });
  panelEl.querySelector<HTMLButtonElement>("#tower-repeat-floor")?.addEventListener("click", () => {
    void handleRepeatFloor();
  });
  panelEl.querySelector<HTMLInputElement>("#tower-continuous-attack")?.addEventListener("change", (e) => {
    void handleContinuousAttackChange((e.target as HTMLInputElement).checked);
  });
  panelEl.querySelector<HTMLInputElement>("#tower-auto-ascend")?.addEventListener("change", (e) => {
    const errorEl = document.querySelector<HTMLParagraphElement>("#game-error");
    if (errorEl) void handleAutoAscendChange((e.target as HTMLInputElement).checked, errorEl);
  });

  if (options?.autoStart !== true) return;
  if (!cachedState?.characterJson.tower.continuousAttack || !canStartTowerCombat(cachedState)) return;
  if (isTowerCombatLoopRunning()) return;

  void waitForTowerAnimatorsReady().then(() => {
    if (bindId !== towerBindSerial) return;
    if (isTowerCombatLoopRunning() || !cachedState) return;
    if (!cachedState.characterJson.tower.continuousAttack || !canStartTowerCombat(cachedState)) return;
    startContinuousCombat();
  });
}

async function handleNavigateFloor(
  direction: "up" | "down",
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
    renderActivePanel({ forceTowerRemount: true, forceDockRemount: true });
  } catch (err) {
    showGameError(formatApiError(err, "Falha ao trocar de andar."));
  } finally {
    busy = false;
  }
}

async function handleRepeatFloor(): Promise<void> {
  if (busy || !cachedState) return;

  stopTowerCombatLoop();
  busy = true;
  const errorEl = document.querySelector<HTMLParagraphElement>("#game-error");

  try {
    cachedState = applyGamePatch(cachedState, await repeatTowerFloor(getActiveSlot()));
    if (errorEl) errorEl.hidden = true;
    const root = document.querySelector(".game-hub");
    if (root) updateSidebar(root as HTMLElement, cachedState);
    renderActivePanel({ forceTowerRemount: true, forceDockRemount: true });
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
    const checkbox = document.querySelector<HTMLInputElement>("#tower-auto-ascend");
    if (checkbox) {
      checkbox.checked = cachedState.characterJson.tower.autoAscend;
    }
  }
}

async function disableContinuousAttackAfterDefeat(): Promise<void> {
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
  renderActivePanel({ forceTowerRemount: true, forceDockRemount: true });
}

async function handleContinuousAttackChange(checked: boolean): Promise<void> {
  if (!cachedState) return;

  const panelEl = getTabPanel();
  const errorEl = document.querySelector<HTMLParagraphElement>("#game-error");

  if (!checked) {
    stopTowerCombatLoop();
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
      startContinuousCombat();
      if (activeTab === "tower") {
        setTowerControlsDisabled(panelEl, true);
      }
    } else {
      renderActivePanel({ forceTowerRemount: true, forceDockRemount: true });
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
