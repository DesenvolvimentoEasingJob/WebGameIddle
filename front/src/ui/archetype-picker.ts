import { formatCategorySummary, type CategoryTree } from "./game-assets";

export interface PickerOption {
  id: string;
  name: string;
  description?: string;
  spriteUrl: string | null;
  categories?: CategoryTree;
}

export interface ArchetypePickerConfig {
  stepLabel: string;
  hint: string;
  confirmLabel: string;
  options: PickerOption[];
  onConfirm: (id: string) => Promise<void>;
  onBack: () => void;
}

export function mountArchetypePicker(
  root: HTMLElement,
  config: ArchetypePickerConfig,
): void {
  root.innerHTML = `
    <section class="ui-panel mx-auto ui-panel--picker" aria-label="${config.stepLabel}">
      <div class="ui-divider" role="presentation"></div>
      <div class="px-2 px-sm-4 py-3">
        <p class="wizard-step">${config.stepLabel}</p>
        <p class="wizard-hint">${config.hint}</p>
        <div class="picker-layout">
          <div class="picker-list" role="listbox" aria-label="Opções"></div>
          <div class="picker-preview" aria-live="polite">
            <div class="picker-preview__frame">
              <img class="picker-preview__sprite" alt="" hidden />
              <p class="picker-preview__placeholder">Selecione uma opção</p>
            </div>
            <h3 class="picker-preview__title"></h3>
            <p class="picker-preview__desc"></p>
            <ul class="picker-preview__stats"></ul>
          </div>
        </div>
        <p class="picker-error auth-error" role="alert" hidden></p>
        <div class="picker-actions">
          <button type="button" class="ui-btn ui-btn--sm picker-confirm" disabled>${config.confirmLabel}</button>
          <button type="button" class="ui-btn ui-btn--sm ui-btn--ghost picker-back">Voltar aos slots</button>
        </div>
      </div>
      <div class="ui-divider ui-divider--flip" role="presentation"></div>
    </section>
  `;

  const listEl = root.querySelector<HTMLElement>(".picker-list")!;
  const spriteEl = root.querySelector<HTMLImageElement>(".picker-preview__sprite")!;
  const placeholderEl = root.querySelector<HTMLElement>(".picker-preview__placeholder")!;
  const titleEl = root.querySelector<HTMLElement>(".picker-preview__title")!;
  const descEl = root.querySelector<HTMLElement>(".picker-preview__desc")!;
  const statsEl = root.querySelector<HTMLElement>(".picker-preview__stats")!;
  const confirmBtn = root.querySelector<HTMLButtonElement>(".picker-confirm")!;
  const errorEl = root.querySelector<HTMLParagraphElement>(".picker-error")!;

  let selectedId: string | null = null;

  listEl.innerHTML = config.options
    .map(
      (option) => `
      <button
        type="button"
        class="picker-option"
        role="option"
        data-id="${option.id}"
        aria-selected="false"
      >
        <span class="picker-option__name">${option.name}</span>
      </button>
    `,
    )
    .join("");

  root.querySelector<HTMLButtonElement>(".picker-back")!.addEventListener("click", () => {
    config.onBack();
  });

  confirmBtn.addEventListener("click", () => {
    if (!selectedId) return;
    void confirmSelection(selectedId);
  });

  listEl.querySelectorAll<HTMLButtonElement>(".picker-option").forEach((btn) => {
    btn.addEventListener("click", () => selectOption(btn.dataset.id!));
  });

  if (config.options.length > 0) {
    selectOption(config.options[0]!.id);
  }

  function selectOption(id: string): void {
    selectedId = id;
    const option = config.options.find((o) => o.id === id);
    if (!option) return;

    listEl.querySelectorAll<HTMLButtonElement>(".picker-option").forEach((btn) => {
      const active = btn.dataset.id === id;
      btn.classList.toggle("picker-option--active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });

    confirmBtn.disabled = false;

    if (option.spriteUrl) {
      spriteEl.src = option.spriteUrl;
      spriteEl.alt = option.name;
      spriteEl.hidden = false;
      placeholderEl.hidden = true;
    } else {
      spriteEl.hidden = true;
      spriteEl.removeAttribute("src");
      placeholderEl.hidden = false;
      placeholderEl.textContent = "Sprite indisponível";
    }

    titleEl.textContent = option.name;
    descEl.textContent = option.description ?? "";

    const stats = formatCategorySummary(option.categories);
    statsEl.innerHTML = stats.map((line) => `<li>${line}</li>`).join("");
    statsEl.hidden = stats.length === 0;
  }

  async function confirmSelection(id: string): Promise<void> {
    errorEl.hidden = true;
    confirmBtn.disabled = true;
    listEl.querySelectorAll<HTMLButtonElement>(".picker-option").forEach((b) => {
      b.disabled = true;
    });

    try {
      await config.onConfirm(id);
    } catch (err) {
      confirmBtn.disabled = false;
      listEl.querySelectorAll<HTMLButtonElement>(".picker-option").forEach((b) => {
        b.disabled = false;
      });
      errorEl.textContent =
        err instanceof Error ? err.message : "Não foi possível confirmar a seleção.";
      errorEl.hidden = false;
    }
  }
}
