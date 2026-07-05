import {
  deleteCharacter,
  fetchCharacterSlots,
  type CharacterSlot,
} from "../api/characters";
import { formatApiError } from "../api/auth";
import {
  clearSession,
  getStoredUser,
  navigate,
  setActiveCharacterMeta,
  setActiveSlot,
} from "../router";

function slotLabel(slot: CharacterSlot): string {
  if (!slot.occupied) return "Slot vazio";
  if (slot.status === "complete") {
    return `${capitalize(slot.raceId)} · ${capitalize(slot.classId)}`;
  }
  return `${capitalize(slot.raceId)} (escolher classe)`;
}

function capitalize(value?: string): string {
  if (!value) return "—";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function slotAction(slot: CharacterSlot): { label: string; next: "create-race" | "create-class" | "game" | null } {
  if (!slot.occupied) {
    return { label: "Criar personagem", next: "create-race" };
  }
  if (slot.status === "draft") {
    return { label: "Escolher classe", next: "create-class" };
  }
  return { label: "Entrar", next: "game" };
}

export function renderSlots(root: HTMLElement): void {
  const user = getStoredUser();

  root.innerHTML = `
    <section class="ui-panel mx-auto ui-panel--wide" aria-label="Slots de personagem">
      <div class="ui-divider" role="presentation"></div>
      <div class="px-2 px-sm-4 py-3">
        <p class="slots-greeting">Olá, <strong>${user?.username ?? "aventureiro"}</strong></p>
        <p class="slots-hint">Escolha um slot. Novos personagens começam pela <strong>raça</strong>, depois a <strong>classe</strong>.</p>
        <div id="slots-list" class="slots-list" aria-live="polite">
          <p class="slots-loading">Carregando slots…</p>
        </div>
        <p id="slots-error" class="auth-error" role="alert" hidden></p>
        <div class="d-grid gap-2 mt-3">
          <button id="slots-logout" type="button" class="ui-btn ui-btn--ghost ui-btn--sm">Sair</button>
        </div>
      </div>
      <div class="ui-divider ui-divider--flip" role="presentation"></div>
    </section>
  `;

  const listEl = root.querySelector<HTMLElement>("#slots-list")!;
  const errorEl = root.querySelector<HTMLParagraphElement>("#slots-error")!;

  root.querySelector<HTMLButtonElement>("#slots-logout")!.addEventListener("click", () => {
    clearSession();
    navigate("home");
  });

  void loadSlots();

  async function loadSlots(): Promise<void> {
    errorEl.hidden = true;
    try {
      const slots = await fetchCharacterSlots();
      renderSlotButtons(slots);
    } catch (err) {
      listEl.innerHTML = "";
      errorEl.textContent = formatApiError(err, "Não foi possível carregar os slots.");
      errorEl.hidden = false;
    }
  }

  function renderSlotButtons(slots: CharacterSlot[]): void {
    listEl.innerHTML = slots
      .map((slot) => {
        const action = slotAction(slot);
        const disabled = "";
        const deleteBtn = slot.occupied
          ? `<button type="button" class="ui-btn-close slot-card__delete" data-slot="${slot.slotIndex}" aria-label="Excluir personagem do slot ${slot.slotIndex + 1}"></button>`
          : "";

        return `
          <article class="slot-card">
            <header class="slot-card__header">
              <div class="slot-card__meta">
                <span class="slot-card__index">Slot ${slot.slotIndex + 1}</span>
                <span class="slot-card__status">${slotLabel(slot)}</span>
              </div>
              ${deleteBtn}
            </header>
            <div class="slot-card__actions">
              <button
                type="button"
                class="ui-btn ui-btn--sm slot-card__btn"
                data-slot="${slot.slotIndex}"
                data-next="${action.next ?? ""}"
                ${disabled}
              >${action.label}</button>
            </div>
          </article>
        `;
      })
      .join("");

    listEl.querySelectorAll<HTMLButtonElement>(".slot-card__btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const slotIndex = Number(btn.dataset.slot);
        const next = btn.dataset.next as "create-race" | "create-class" | "game" | "";
        if (!next) return;

        const slot = slots.find((s) => s.slotIndex === slotIndex);
        setActiveSlot(slotIndex);
        setActiveCharacterMeta({
          raceId: slot?.raceId,
          classId: slot?.classId,
        });
        navigate(next);
      });
    });

    listEl.querySelectorAll<HTMLButtonElement>(".slot-card__delete").forEach((btn) => {
      btn.addEventListener("click", () => void handleDelete(Number(btn.dataset.slot), btn));
    });
  }

  async function handleDelete(slotIndex: number, btn: HTMLButtonElement): Promise<void> {
    const confirmed = window.confirm(
      `Excluir o personagem do slot ${slotIndex + 1}? Esta ação não pode ser desfeita.`,
    );
    if (!confirmed) return;

    errorEl.hidden = true;
    btn.disabled = true;

    try {
      await deleteCharacter(slotIndex);
      await loadSlots();
    } catch (err) {
      errorEl.textContent = formatApiError(err, "Não foi possível excluir o personagem.");
      errorEl.hidden = false;
      btn.disabled = false;
    }
  }
}
