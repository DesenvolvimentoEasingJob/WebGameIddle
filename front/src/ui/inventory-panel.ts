import {
  DEFAULT_EQUIPMENT_SLOTS,
  EQUIP_SLOT_LABELS,
  type GameStateResponse,
  type EquippedEntry,
  type InventoryEntry,
  type ItemSummary,
} from "../api/gameplay";
import { formatItemStatSections, resolveItemIcon, type CategoryTree } from "./game-assets";
import { raritySlotFrameClass, raritySlotFrameStyle, resolveRarityLabel } from "./loot-config";

export type GameTab = "inventory" | "market" | "tower" | "status";

export interface InventoryPanelOptions {
  state: GameStateResponse;
  selectedInstanceId: string | null;
  bulkMode: boolean;
  bulkSelectedIds: string[];
  onSelect: (instanceId: string | null) => void;
  onToggleBulkMode: () => void;
  onBulkSelect: (instanceId: string) => void;
  onBulkDiscard: () => void;
  onEquip: (instanceId: string) => void;
  onUnequip: (equipSlot: string) => void;
  onDiscard: (instanceId: string) => void;
  busy: boolean;
}

export function renderInventoryPanel(options: InventoryPanelOptions): string {
  const { state, selectedInstanceId, bulkMode, bulkSelectedIds, busy } = options;
  const char = state.characterJson;
  const catalog = state.itemCatalog;
  const equipSlots = char.equipmentSlots?.length
    ? char.equipmentSlots
    : [...DEFAULT_EQUIPMENT_SLOTS];

  const selected = findSelectedItem(char.inventory.items, char.equipment, selectedInstanceId, catalog);
  const lootConfig = state.lootConfig;

  return `
    <div class="inventory-layout">
      <div class="inventory-equip-column">
        <div class="inventory-mode-bar">
          <button
            type="button"
            class="ui-btn ui-btn--sm${bulkMode ? " ui-btn--active" : ""}"
            data-action="toggle-bulk-mode"
            aria-pressed="${bulkMode}"
            ${busy ? "disabled" : ""}
          >
            Inventário
          </button>
          ${
            bulkMode
              ? `<span class="inventory-mode-bar__hint">${bulkSelectedIds.length} selecionado(s)</span>`
              : ""
          }
        </div>
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
                  lootConfig,
                ),
              )
              .join("")}
          </div>
        </section>
        ${
          bulkMode
            ? `<div class="inventory-bulk-actions">
                <button
                  type="button"
                  class="ui-btn ui-btn--sm ui-btn--discard"
                  data-action="bulk-discard"
                  ${busy || bulkSelectedIds.length === 0 ? "disabled" : ""}
                >
                  Descartar selecionados
                </button>
              </div>`
            : ""
        }
      </div>

      <section class="inventory-bag" aria-label="Inventário">
        <header class="inventory-bag__header">
          <h2 class="game-panel__title">Inventário</h2>
          <span class="inventory-bag__count">${char.inventory.items.length} / ${char.inventory.capacity}</span>
        </header>
        <div class="inventory-bag__frame">
          <div class="inventory-bag__scroll">
            <div class="item-grid item-grid--bag">
              ${renderBagSlots(char.inventory, catalog, selectedInstanceId, bulkMode, bulkSelectedIds, busy, lootConfig)}
            </div>
          </div>
        </div>
      </section>

      <aside class="inventory-detail" aria-label="Detalhes do item">
        ${bulkMode ? renderBulkDetail(bulkSelectedIds, options) : renderItemDetail(selected, options)}
      </aside>
    </div>
  `;
}

function renderEquipSlot(
  slot: string,
  label: string,
  equipped: EquippedEntry | null | undefined,
  catalog: Record<string, ItemSummary>,
  selectedInstanceId: string | null,
  busy: boolean,
  lootConfig: GameStateResponse["lootConfig"],
): string {
  const item = equipped ? catalog[equipped.itemId] : null;
  const selected = equipped?.instanceId === selectedInstanceId;
  const emptyClass = item ? "" : " item-slot--empty";
  const rarity = equipped ? (equipped.rarity ?? item?.rarity ?? "common") : "common";
  const rarityFrame = raritySlotFrameClass(rarity, lootConfig);
  const rarityStyle = raritySlotFrameStyle(rarity, lootConfig);
  const entry = equipped
    ? {
        instanceId: equipped.instanceId,
        itemId: equipped.itemId,
        quantity: 1,
        rarity: equipped.rarity,
        rolledCategories: equipped.rolledCategories,
        rolledAffixes: equipped.rolledAffixes,
      }
    : null;

  return `
    <button
      type="button"
      class="item-slot item-slot--equip${rarityFrame}${rarityStyle ? " item-slot--rarity-frame" : ""}${emptyClass}${selected ? " item-slot--selected" : ""}"
      style="${rarityStyle ?? ""}"
      data-equip-slot="${slot}"
      data-instance-id="${equipped?.instanceId ?? ""}"
      aria-label="${label}${item ? `: ${item.name}` : " (vazio)"}"
      ${busy ? "disabled" : ""}
    >
      <span class="item-slot__label">${label}</span>
      ${renderItemSlotContent(item, entry)}
    </button>
  `;
}

function renderBulkDetail(bulkSelectedIds: string[], options: InventoryPanelOptions): string {
  const count = bulkSelectedIds.length;

  if (count === 0) {
    return `
      <div class="inventory-detail__empty">
        <p>Selecione itens do inventário para descartar.</p>
        <p class="inventory-detail__hint">Clique nos itens para marcar ou desmarcar.</p>
      </div>
    `;
  }

  return `
    <div class="inventory-detail__bulk">
      <p class="inventory-detail__bulk-count">${count} item${count === 1 ? "" : "s"} selecionado${count === 1 ? "" : "s"}</p>
      <div class="inventory-detail__actions">
        <button
          type="button"
          class="ui-btn ui-btn--sm ui-btn--discard"
          data-action="bulk-discard"
          ${options.busy ? "disabled" : ""}
        >
          Descartar selecionados
        </button>
      </div>
    </div>
  `;
}

function renderBagSlots(
  inventory: { capacity: number; items: InventoryEntry[] },
  catalog: Record<string, ItemSummary>,
  selectedInstanceId: string | null,
  bulkMode: boolean,
  bulkSelectedIds: string[],
  busy: boolean,
  lootConfig: GameStateResponse["lootConfig"],
): string {
  const slots: string[] = [];

  for (let i = 0; i < inventory.capacity; i++) {
    const entry = inventory.items[i];
    if (entry) {
      const item = catalog[entry.itemId];
      const selected = bulkMode
        ? bulkSelectedIds.includes(entry.instanceId)
        : entry.instanceId === selectedInstanceId;
      const qty = entry.quantity > 1 ? `<span class="item-slot__qty">×${entry.quantity}</span>` : "";

      const rarity = entry.rarity ?? item?.rarity ?? "common";
      const rarityFrame = raritySlotFrameClass(rarity, lootConfig);
      const rarityStyle = raritySlotFrameStyle(rarity, lootConfig);

      slots.push(`
        <button
          type="button"
          class="item-slot item-slot--bag${rarityFrame}${rarityStyle ? " item-slot--rarity-frame" : ""}${selected ? " item-slot--selected" : ""}"
          style="${rarityStyle ?? ""}"
          data-instance-id="${entry.instanceId}"
          aria-label="${item?.name ?? entry.itemId}"
          ${busy ? "disabled" : ""}
        >
          ${qty}
          ${renderItemSlotContent(item, entry)}
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

  const displayItem = resolveDisplayItem(entry, item);
  const rarityLabel = resolveRarityLabel(displayItem.rarity, options.state.lootConfig);
  const statSections = formatItemStatSections(entry, item.categories as CategoryTree | undefined);
  const canEquip = displayItem.slot !== null && displayItem.slot !== undefined;
  const isEquipped = equipSlot !== null;
  const equippedComparison = !isEquipped && displayItem.slot
    ? resolveEquippedItem(
        options.state.characterJson.equipment[displayItem.slot],
        options.state.itemCatalog,
      )
    : null;

  const iconUrl = resolveItemIcon(displayItem.assets);

  return `
    <div class="inventory-detail__card inventory-detail__card--${displayItem.rarity}">
      <img class="inventory-detail__icon" src="${iconUrl}" alt="" aria-hidden="true" />
      <header class="inventory-detail__header">
        <h3 class="inventory-detail__name">${displayItem.name}</h3>
        <span class="inventory-detail__rarity">${rarityLabel}</span>
      </header>
      <p class="inventory-detail__type">${displayItem.type}${displayItem.level ? ` · Nv. ${displayItem.level}` : ""}</p>
      ${item.description ? `<p class="inventory-detail__desc">${displayItem.description}</p>` : ""}
      ${
        statSections.base.length
          ? `<ul class="inventory-detail__stats">${statSections.base.map((s) => `<li>${s}</li>`).join("")}</ul>`
          : ""
      }
      ${
        statSections.additional.length
          ? `<div class="inventory-detail__affixes">
              <h4 class="inventory-detail__affixes-title">Atributos adicionais</h4>
              <ul class="inventory-detail__stats inventory-detail__stats--affixes">
                ${statSections.additional.map((s) => `<li>${s}</li>`).join("")}
              </ul>
            </div>`
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
        ${
          !isEquipped
            ? `${equippedComparison ? `<button type="button" class="ui-btn ui-btn--sm" data-action="compare">Comparar</button>` : ""}
               <button type="button" class="ui-btn ui-btn--sm ui-btn--discard" data-action="discard" data-instance-id="${entry.instanceId}" ${options.busy ? "disabled" : ""}>Descartar</button>`
            : ""
        }
      </div>
    </div>
    ${equippedComparison ? renderComparisonDialog(equippedComparison, { entry, item }, options) : ""}
  `;
}

function resolveEquippedItem(
  equipped: EquippedEntry | null | undefined,
  catalog: Record<string, ItemSummary>,
): { entry: InventoryEntry; item: ItemSummary } | null {
  if (!equipped) return null;

  const item = catalog[equipped.itemId];
  if (!item) return null;

  return {
    entry: {
      instanceId: equipped.instanceId,
      itemId: equipped.itemId,
      quantity: 1,
      rarity: equipped.rarity,
      rolledCategories: equipped.rolledCategories,
      rolledAffixes: equipped.rolledAffixes,
    },
    item,
  };
}

function renderComparisonDialog(
  equipped: { entry: InventoryEntry; item: ItemSummary },
  selected: { entry: InventoryEntry; item: ItemSummary },
  options: InventoryPanelOptions,
): string {
  return `
    <dialog class="ui-modal item-compare" aria-labelledby="item-compare-title">
      <section class="ui-panel ui-panel--picker item-compare__panel" aria-label="Comparar atributos">
        <div class="ui-divider" role="presentation"></div>
        <div class="item-compare__content">
          <header class="item-compare__header">
            <p id="item-compare-title" class="wizard-step">Comparar itens</p>
            <form method="dialog">
              <button type="submit" class="ui-btn-close" aria-label="Fechar comparação"></button>
            </form>
          </header>
          <div class="item-compare__grid">
            ${renderComparisonItem("Equipado", equipped.entry, equipped.item, options.state.lootConfig)}
            ${renderComparisonItem("Selecionado", selected.entry, selected.item, options.state.lootConfig)}
          </div>
          <div class="item-compare__actions">
            <button
              type="button"
              class="ui-btn ui-btn--sm"
              data-action="replace"
              data-instance-id="${selected.entry.instanceId}"
              ${options.busy ? "disabled" : ""}
            >Substituir</button>
          </div>
        </div>
        <div class="ui-divider ui-divider--flip" role="presentation"></div>
      </section>
    </dialog>
  `;
}

function renderComparisonItem(
  label: string,
  entry: InventoryEntry,
  item: ItemSummary,
  lootConfig: GameStateResponse["lootConfig"],
): string {
  const displayItem = resolveDisplayItem(entry, item);
  const rarityLabel = resolveRarityLabel(displayItem.rarity, lootConfig);
  const statSections = formatItemStatSections(entry, item.categories as CategoryTree | undefined);
  const iconUrl = resolveItemIcon(displayItem.assets);
  const typeLine = `${displayItem.type}${displayItem.level ? ` · Nv. ${displayItem.level}` : ""}`;

  return `
    <section class="picker-preview item-compare__column" aria-label="${label}: ${displayItem.name}">
      <span class="item-compare__label">${label}</span>
      <div class="picker-preview__frame item-compare__icon-frame">
        <img class="item-compare__icon" src="${iconUrl}" alt="" aria-hidden="true" />
      </div>
      <header class="inventory-detail__header item-compare__meta">
        <h3 class="inventory-detail__name">${displayItem.name}</h3>
        <span class="inventory-detail__rarity">${rarityLabel}</span>
      </header>
      <p class="inventory-detail__type">${typeLine}</p>
      ${item.description ? `<p class="inventory-detail__desc">${displayItem.description}</p>` : ""}
      ${
        statSections.base.length
          ? `<ul class="inventory-detail__stats">${statSections.base.map((stat) => `<li>${stat}</li>`).join("")}</ul>`
          : ""
      }
      ${
        statSections.additional.length
          ? `<div class="inventory-detail__affixes">
              <h4 class="inventory-detail__affixes-title">Atributos adicionais</h4>
              <ul class="inventory-detail__stats inventory-detail__stats--affixes">
                ${statSections.additional.map((stat) => `<li>${stat}</li>`).join("")}
              </ul>
            </div>`
          : ""
      }
      ${
        !statSections.base.length && !statSections.additional.length
          ? `<p class="picker-preview__placeholder">Sem atributos.</p>`
          : ""
      }
    </section>
  `;
}

function renderItemSlotContent(
  item: ItemSummary | null | undefined,
  entry?: InventoryEntry | null,
): string {
  if (!item) return "";

  const displayItem = entry ? resolveDisplayItem(entry, item) : item;
  const iconUrl = resolveItemIcon(displayItem.assets);
  return `<img class="item-slot__icon" src="${iconUrl}" alt="" aria-hidden="true" />`;
}

function resolveDisplayItem(entry: InventoryEntry, catalogItem: ItemSummary): ItemSummary {
  return {
    ...catalogItem,
    rarity: entry.rarity ?? catalogItem.rarity,
    level: entry.level ?? catalogItem.level,
    categories: (entry.rolledCategories ?? catalogItem.categories) as ItemSummary["categories"],
  };
}

function findSelectedItem(
  bagItems: InventoryEntry[],
  equipment: Record<string, EquippedEntry | null>,
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
        entry: {
          instanceId: equipped.instanceId,
          itemId: equipped.itemId,
          quantity: 1,
          rarity: equipped.rarity,
          rolledCategories: equipped.rolledCategories,
          rolledAffixes: equipped.rolledAffixes,
        },
        item: catalog[equipped.itemId] ?? null,
        equipSlot: slot,
      };
    }
  }

  return { entry: null, item: null, equipSlot: null };
}

export function bindInventoryPanel(root: HTMLElement, options: InventoryPanelOptions): void {
  root.querySelector<HTMLButtonElement>('[data-action="toggle-bulk-mode"]')?.addEventListener("click", () => {
    options.onToggleBulkMode();
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="bulk-discard"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      options.onBulkDiscard();
    });
  });

  root.querySelectorAll<HTMLButtonElement>(".item-slot--bag[data-instance-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.instanceId;
      if (!id) return;
      if (options.bulkMode) {
        options.onBulkSelect(id);
        return;
      }
      options.onSelect(id === options.selectedInstanceId ? null : id);
    });
  });

  root.querySelectorAll<HTMLButtonElement>(".item-slot--equip[data-instance-id]").forEach((btn) => {
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

  root.querySelector<HTMLButtonElement>('[data-action="discard"]')?.addEventListener("click", (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const id = btn.dataset.instanceId;
    if (id) options.onDiscard(id);
  });

  const compareDialog = root.querySelector<HTMLDialogElement>(".ui-modal.item-compare");
  root.querySelector<HTMLButtonElement>('[data-action="compare"]')?.addEventListener("click", () => {
    compareDialog?.showModal();
  });

  compareDialog?.addEventListener("click", (event) => {
    if (event.target === compareDialog) compareDialog.close();
  });

  compareDialog?.querySelector<HTMLButtonElement>('[data-action="replace"]')?.addEventListener("click", (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const id = btn.dataset.instanceId;
    if (!id) return;
    compareDialog?.close();
    options.onEquip(id);
  });
}

export function computeDisplayStats(state: GameStateResponse): {
  attack: number;
  defense: number;
  hp: number;
  mp: number;
} {
  const attrs = (state.effectiveCategories as CategoryTree)?.attributes ?? {};
  const combat = (state.effectiveCategories as CategoryTree)?.combat ?? {};
  const damage = (state.effectiveCategories as CategoryTree)?.damage ?? {};
  const read = (key: string) => {
    const node = attrs[key];
    return (node?.base ?? 0) + (node?.bonus ?? 0);
  };
  const str = read("strength");
  const agi = read("agility");
  const int = read("intelligence");
  const level = state.characterJson.progression?.level ?? 1;
  const hpBonus = Number(combat.hpBonus) || 0;
  const physicalBonus = damage.physical?.bonusPercent ?? 0;
  const magicalBonus = damage.magical?.bonusPercent ?? 0;

  let attack = str * 12 + agi * 4 + int * 2 + level * 10;
  const bonusPercent = Math.max(physicalBonus, magicalBonus);
  if (bonusPercent > 0) {
    attack = Math.round(attack * (1 + bonusPercent / 100));
  }

  return {
    attack: Math.round(attack),
    defense: Math.round(str * 3 + agi * 6 + int * 2 + level * 8),
    hp: Math.round(str * 8 + agi * 4 + int * 3 + level * 50 + hpBonus),
    mp: Math.round(int * 12 + level * 30),
  };
}

/** Percentuais 0–100 para as barras do painel (HP/MP cheios até existir combate no backend). */
export function computeVitalBarPercents(state: GameStateResponse): {
  hp: number;
  mp: number;
  xp: number;
} {
  const level = state.characterJson.progression?.level ?? 1;
  const xp = state.characterJson.progression?.xp ?? 0;
  const xpToNext = Math.max(1, level * 100);

  return {
    hp: 100,
    mp: 100,
    xp: Math.min(100, Math.round((xp / xpToNext) * 100)),
  };
}

export { EQUIP_SLOT_LABELS };
