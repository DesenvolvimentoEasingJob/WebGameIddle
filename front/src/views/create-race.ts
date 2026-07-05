import { fetchRaces, type RaceSummary } from "../api/game";
import { selectRace } from "../api/characters";
import { formatApiError } from "../api/auth";
import { getActiveSlot, navigate } from "../router";
import { mountArchetypePicker } from "../ui/archetype-picker";
import { resolveRaceSprite, type CategoryTree } from "../ui/game-assets";

export function renderCreateRace(root: HTMLElement): void {
  const slotIndex = getActiveSlot();

  root.innerHTML = `<p class="slots-loading px-2 py-3">Carregando raças…</p>`;

  void loadRaces();

  async function loadRaces(): Promise<void> {
    try {
      const races = await fetchRaces();
      mountArchetypePicker(root, {
        stepLabel: "Passo 1 de 2 — <strong>Raça</strong>",
        hint: `Slot ${slotIndex + 1}. Escolha sua raça à esquerda e visualize o personagem à direita.`,
        confirmLabel: "Confirmar raça",
        options: races.map(toRaceOption),
        onConfirm: async (raceId) => {
          try {
            await selectRace(slotIndex, raceId);
            navigate("create-class");
          } catch (err) {
            throw new Error(formatApiError(err, "Não foi possível salvar a raça."));
          }
        },
        onBack: () => navigate("slots"),
      });
    } catch (err) {
      root.innerHTML = `
        <section class="ui-panel mx-auto ui-panel--picker">
          <div class="ui-divider" role="presentation"></div>
          <div class="px-2 px-sm-4 py-3">
            <p class="auth-error">${formatApiError(err, "Não foi possível carregar as raças.")}</p>
            <button type="button" class="ui-btn ui-btn--ghost mt-3" id="race-fallback-back">Voltar</button>
          </div>
          <div class="ui-divider ui-divider--flip" role="presentation"></div>
        </section>
      `;
      root.querySelector<HTMLButtonElement>("#race-fallback-back")!.addEventListener("click", () => {
        navigate("slots");
      });
    }
  }
}

function toRaceOption(race: RaceSummary) {
  return {
    id: race.id,
    name: race.name,
    description: race.description,
    spriteUrl: resolveRaceSprite(race.assets),
    categories: race.categories as CategoryTree | undefined,
  };
}
