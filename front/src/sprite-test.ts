import "./style.css";

import { getAllAnimMaps } from "./animation/sprite-registry";
import { createEnemySprite, createPlayerSprite, type SpriteAnimator } from "./animation/SpriteAnimator";

type AnimName = "idle" | "attack" | "critical";

interface TestEntry {
  id: string;
  label: string;
  create: (el: HTMLElement) => SpriteAnimator | null;
}

const entries: TestEntry[] = getAllAnimMaps().map((map) => ({
  id: map.id,
  label: map.id,
  create: (el) =>
    map.id === "elf-mage"
      ? createPlayerSprite(el, map)
      : createEnemySprite(el, map),
}));

const animators = new Map<string, SpriteAnimator>();
const logEl = { current: null as HTMLElement | null };

function log(message: string): void {
  if (!logEl.current) return;
  logEl.current.textContent = `${new Date().toLocaleTimeString("pt-BR")} — ${message}`;
}

function playAll(animation: AnimName): void {
  for (const entry of entries) {
    const animator = animators.get(entry.id);
    if (!animator) continue;
    animator.play(animation, {
      onEnd: () => log(`${entry.label}: ${animation} terminou → idle`),
    });
  }
  log(`Todos: ${animation}`);
}

function render(): void {
  const root = document.getElementById("sprite-test-root");
  if (!root) return;

  root.innerHTML = `
    <main class="sprite-test-page">
      <h1>Teste de Sprite Sheets</h1>
      <p>Anim maps atlas-based · viewport + offset por frame · <a href="http://localhost:5199/#anim-map" target="_blank" rel="noopener">Abrir Dev Tools</a></p>

      <div class="sprite-test-global">
        <button type="button" data-global="idle">Todos — Idle</button>
        <button type="button" data-global="attack">Todos — Attack</button>
        <button type="button" data-global="critical">Todos — Critical</button>
      </div>

      <div class="sprite-test-grid">
        ${entries
          .map(
            (entry) => `
          <article class="sprite-test-card" data-entry="${entry.id}">
            <h2>${entry.label}</h2>
            <div class="sprite-test-stage">
              <div class="sprite-sheet-stage" id="sprite-${entry.id}" aria-hidden="true"></div>
            </div>
            <div class="sprite-test-controls">
              <button type="button" data-entry="${entry.id}" data-anim="idle">Idle</button>
              <button type="button" data-entry="${entry.id}" data-anim="attack">Attack</button>
              <button type="button" data-entry="${entry.id}" data-anim="critical">Critical</button>
            </div>
          </article>
        `,
          )
          .join("")}
      </div>

      <div class="sprite-test-log" id="sprite-test-log" aria-live="polite"></div>
    </main>
  `;

  logEl.current = root.querySelector("#sprite-test-log");

  for (const entry of entries) {
    const el = root.querySelector<HTMLElement>(`#sprite-${entry.id}`);
    if (!el) continue;

    const animator = entry.create(el);
    if (!animator) continue;

    animators.set(entry.id, animator);
    void animator.whenReady().then(() => {
      animator.play("idle");
      log(`${entry.label} pronto (idle)`);
    });
  }

  root.querySelectorAll<HTMLButtonElement>("[data-global]").forEach((btn) => {
    btn.addEventListener("click", () => {
      playAll(btn.dataset.global as AnimName);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-entry][data-anim]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const entryId = btn.dataset.entry!;
      const anim = btn.dataset.anim as AnimName;
      const entry = entries.find((e) => e.id === entryId);
      const animator = animators.get(entryId);
      if (!animator || !entry) return;

      animator.play(anim, {
        onEnd: () => log(`${entry.label}: ${anim} terminou → idle`),
      });
      log(`${entry.label}: ${anim}`);
    });
  });
}

render();
