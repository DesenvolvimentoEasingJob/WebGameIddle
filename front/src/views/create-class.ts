import { fetchClasses, type ClassSummary } from "../api/game";
import { fetchCharacterSlots, selectClass } from "../api/characters";
import { formatApiError } from "../api/auth";
import { getActiveSlot, navigate } from "../router";
import { mountArchetypePicker } from "../ui/archetype-picker";
import { resolveClassSprite, type CategoryTree } from "../ui/game-assets";

export function renderCreateClass(root: HTMLElement): void {
  const slotIndex = getActiveSlot();

  root.innerHTML = `<p class="slots-loading px-2 py-3">Carregando classes…</p>`;

  void loadClasses();

  async function loadClasses(): Promise<void> {
    try {
      const [classes, slots] = await Promise.all([
        fetchClasses(),
        fetchCharacterSlots(),
      ]);

      const slot = slots.find((s) => s.slotIndex === slotIndex);
      const raceId = slot?.raceId;

      if (!raceId) {
        navigate("create-race");
        return;
      }

      mountArchetypePicker(root, {
        stepLabel: "Passo 2 de 2 — <strong>Classe</strong>",
        hint: `Slot ${slotIndex + 1}. A classe soma atributos à raça escolhida (${capitalize(raceId)}).`,
        confirmLabel: "Confirmar classe",
        options: classes.map((cls) => toClassOption(cls, raceId)),
        onConfirm: async (classId) => {
          try {
            await selectClass(slotIndex, classId);
            navigate("slots");
          } catch (err) {
            throw new Error(formatApiError(err, "Não foi possível salvar a classe."));
          }
        },
        onBack: () => navigate("slots"),
      });
    } catch (err) {
      root.innerHTML = `
        <section class="ui-panel mx-auto ui-panel--picker">
          <div class="ui-divider" role="presentation"></div>
          <div class="px-2 px-sm-4 py-3">
            <p class="auth-error">${formatApiError(err, "Não foi possível carregar as classes.")}</p>
            <button type="button" class="ui-btn ui-btn--ghost mt-3" id="class-fallback-back">Voltar</button>
          </div>
          <div class="ui-divider ui-divider--flip" role="presentation"></div>
        </section>
      `;
      root.querySelector<HTMLButtonElement>("#class-fallback-back")!.addEventListener("click", () => {
        navigate("slots");
      });
    }
  }
}

function toClassOption(cls: ClassSummary, raceId: string) {
  return {
    id: cls.id,
    name: cls.name,
    description: cls.description,
    spriteUrl: resolveClassSprite(raceId, cls.assets),
    categories: cls.categories as CategoryTree | undefined,
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
