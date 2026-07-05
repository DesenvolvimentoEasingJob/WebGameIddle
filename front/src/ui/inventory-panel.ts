import {
  DEFAULT_EQUIPMENT_SLOTS,
  EQUIP_SLOT_LABELS,
  RARITY_LABELS,
  type GameStateResponse,
  type InventoryEntry,
  type ItemSummary,
} from "../api/gameplay";
import { formatCategorySummary, resolveItemIcon, type CategoryTree } from "./game-assets";

export type GameTab = "inventory" | "market" | "tower";

export interface InventoryPanelOptions {
  state: GameStateResponse;
  selectedInstanceId: string | null;
  onSelect: (instanceId: string | null) => void;
  onEquip: (instanceId: string) => void;
  onUnequip: (equipSlot: string) => void;
  busy: boolean;
}

export function renderInventoryPanel(options: InventoryPanelOptions): string {
  const { state, selectedInstanceId, busy } = options;
  const char = state.characterJson;
  const catalog = state.itemCatalog;
  const equipSlots = char.equipmentSlots?.length
    ? char.equipmentSlots
    : [...DEFAULT_EQUIPMENT_SLOTS];

  const selected = findSelectedItem(char.inventory.items, char.equipment, selectedInstanceId, catalog);

  return `
    <div class="inventory-layout">
      <section class="inventory-equip" aria-label="Equipamento">
        <h2 class="game-panel__title">Equipamento</h2>
        <div class="equip-grid">
          ${equipSlots
            .map((slot) =>
              renderEquipSlot(
                slot,
                EQUIP_SLOT_LABELS[slot] ?? slot,
                char.equipment[slot],
                catalog,
                selectedInstanceId,
                busy,
              ),
            )
            .join("")}
        </div>
      </section>

      <section class="inventory-bag" aria-label="Inventário">
        <header class="inventory-bag__header">
          <h2 class="game-panel__title">Inventário</h2>
          <span class="inventory-bag__count">${char.inventory.items.length} / ${char.inventory.capacity}</span>
        </header>
        <div class="inventory-bag__frame">
          <div class="inventory-bag__scroll">
            <div class="item-grid item-grid--bag">
              ${renderBagSlots(char.inventory, catalog, selectedInstanceId, busy)}
            </div>
          </div>
        </div>
      </section>

      <aside class="inventory-detail" aria-label="Detalhes do item">
        ${renderItemDetail(selected, options)}
      </aside>
    </div>
  `;
}

function renderEquipSlot(
  slot: string,
  label: string,
  equipped: { instanceId: string; itemId: string } | null | undefined,
  catalog: Record<string, ItemSummary>,
  selectedInstanceId: string | null,
  busy: boolean,
): string {
  const item = equipped ? catalog[equipped.itemId] : null;
  const selected = equipped?.instanceId === selectedInstanceId;
  const emptyClass = item ? "" : " item-slot--empty";

  return `
    <button
      type="button"
      class="item-slot item-slot--equip${emptyClass}${selected ? " item-slot--selected" : ""}"
      data-equip-slot="${slot}"
      data-instance-id="${equipped?.instanceId ?? ""}"
      aria-label="${label}${item ? `: ${item.name}` : " (vazio)"}"
      ${busy ? "disabled" : ""}
    >
      <span class="item-slot__label">${label}</span>
      ${renderItemSlotContent(item)}
    </button>
  `;
}

function renderBagSlots(
  inventory: { capacity: number; items: InventoryEntry[] },
  catalog: Record<string, ItemSummary>,
  selectedInstanceId: string | null,
  busy: boolean,
): string {
  const slots: string[] = [];

  for (let i = 0; i < inventory.capacity; i++) {
    const entry = inventory.items[i];
    if (entry) {
      const item = catalog[entry.itemId];
      const selected = entry.instanceId === selectedInstanceId;
      const qty = entry.quantity > 1 ? `<span class="item-slot__qty">×${entry.quantity}</span>` : "";

      slots.push(`
        <button
          type="button"
          class="item-slot item-slot--bag${selected ? " item-slot--selected" : ""}"
          data-instance-id="${entry.instanceId}"
          aria-label="${item?.name ?? entry.itemId}"
          ${busy ? "disabled" : ""}
        >
          ${qty}
          ${renderItemSlotContent(item)}
        </button>
      `);
    } else {
      slots.push(`<div class="item-slot item-slot--bag item-slot--empty" aria-hidden="true"></div>`);
    }
  }

  return slots.join("");
}

function renderItemDetail(
  selected: { entry: InventoryEntry | null; item: ItemSummary | null; equipSlot: string | null },
  options: InventoryPanelOptions,
): string {
  const { item, entry, equipSlot } = selected;

  if (!item || !entry) {
    return `
      <div class="inventory-detail__empty">
        <p>Selecione um item para ver detalhes.</p>
      </div>
    `;
  }

  const rarityLabel = RARITY_LABELS[item.rarity] ?? item.rarity;
  const stats = formatCategorySummary(item.categories as CategoryTree | undefined);
  const canEquip = item.slot !== null && item.slot !== undefined;
  const isEquipped = equipSlot !== null;

  const iconUrl = resolveItemIcon(item.assets);

  return `
    <div class="inventory-detail__card">
      ${
        iconUrl
          ? `<img class="inventory-detail__icon" src="${iconUrl}" alt="" aria-hidden="true" />`
          : ""
      }
      <header class="inventory-detail__header">
        <h3 class="inventory-detail__name">${item.name}</h3>
        <span class="inventory-detail__rarity">${rarityLabel}</span>
      </header>
      <p class="inventory-detail__type">${item.type}${item.level ? ` · Nv. ${item.level}` : ""}</p>
      ${item.description ? `<p class="inventory-detail__desc">${item.description}</p>` : ""}
      ${
        stats.length
          ? `<ul class="inventory-detail__stats">${stats.map((s) => `<li>${s}</li>`).join("")}</ul>`
          : ""
      }
      <div class="inventory-detail__actions">
        ${
          isEquipped
            ? `<button type="button" class="ui-btn ui-btn--sm" data-action="unequip" data-equip-slot="${equipSlot}" ${options.busy ? "disabled" : ""}>Desequipar</button>`
            : canEquip
              ? `<button type="button" class="ui-btn ui-btn--sm" data-action="equip" data-instance-id="${entry.instanceId}" ${options.busy ? "disabled" : ""}>Equipar</button>`
              : `<p class="inventory-detail__hint">Item de consumo — uso em combate (em breve).</p>`
        }
      </div>
    </div>
  `;
}

function renderItemSlotContent(item: ItemSummary | null | undefined): string {
  if (!item) return "";

  const iconUrl = resolveItemIcon(item.assets);
  if (iconUrl) {
    return `<img class="item-slot__icon" src="${iconUrl}" alt="" aria-hidden="true" />`;
  }

  return `<span class="item-slot__name">${item.name}</span>`;
}

function findSelectedItem(
  bagItems: InventoryEntry[],
  equipment: Record<string, { instanceId: string; itemId: string } | null>,
  selectedInstanceId: string | null,
  catalog: Record<string, ItemSummary>,
): { entry: InventoryEntry | null; item: ItemSummary | null; equipSlot: string | null } {
  if (!selectedInstanceId) {
    return { entry: null, item: null, equipSlot: null };
  }

  const bagEntry = bagItems.find((i) => i.instanceId === selectedInstanceId);
  if (bagEntry) {
    return {
      entry: bagEntry,
      item: catalog[bagEntry.itemId] ?? null,
      equipSlot: null,
    };
  }

  for (const [slot, equipped] of Object.entries(equipment)) {
    if (equipped?.instanceId === selectedInstanceId) {
      return {
        entry: { instanceId: equipped.instanceId, itemId: equipped.itemId, quantity: 1 },
        item: catalog[equipped.itemId] ?? null,
        equipSlot: slot,
      };
    }
  }

  return { entry: null, item: null, equipSlot: null };
}

export function bindInventoryPanel(root: HTMLElement, options: InventoryPanelOptions): void {
  root.querySelectorAll<HTMLButtonElement>("[data-instance-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.instanceId;
      if (!id) return;
      options.onSelect(id === options.selectedInstanceId ? null : id);
    });
  });

  root.querySelector<HTMLButtonElement>('[data-action="equip"]')?.addEventListener("click", (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const id = btn.dataset.instanceId;
    if (id) options.onEquip(id);
  });

  root.querySelector<HTMLButtonElement>('[data-action="unequip"]')?.addEventListener("click", (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const slot = btn.dataset.equipSlot;
    if (slot) options.onUnequip(slot);
  });
}

export function computeDisplayStats(state: GameStateResponse): {
  attack: number;
  defense: number;
  hp: number;
} {
  const attrs = (state.effectiveCategories as CategoryTree)?.attributes ?? {};
  const str = attrs.strength?.base ?? 0;
  const agi = attrs.agility?.base ?? 0;
  const int = attrs.intelligence?.base ?? 0;
  const level = state.characterJson.progression?.level ?? 1;

  return {
    attack: Math.round(str * 12 + agi * 4 + int * 2 + level * 10),
    defense: Math.round(str * 3 + agi * 6 + int * 2 + level * 8),
    hp: Math.round(str * 8 + agi * 4 + int * 3 + level * 50),
  };
}

export { EQUIP_SLOT_LABELS, RARITY_LABELS };
