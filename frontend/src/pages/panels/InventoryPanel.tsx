import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import { apiGet, apiPost, ApiError } from '../../api/client'
import { useGameSession } from '../../game/GameSessionContext'
import { ItemInfoModal } from '../../components/game/ItemInfoModal'
import { ItemTileVisual } from '../../components/game/ItemTileVisual'
import { itemQualityStyle } from '../../game/itemQuality'
import { bagItemShowsUpgradeArrow } from '../../game/itemUpgradeCompare'
import { bagItemLabel, bagItemTemplateId, type BagItem } from '../../types/item'

type InventoryResponse = {
  slotCount: number
  items: BagItem[]
  equipment: Record<string, BagItem | null>
  equipmentSlots: { name: string; itemType: string[]; boxSize: number }[]
}

type DragPayload =
  | { source: 'bag'; bagIndex: number; type: string }
  | { source: 'equip'; slotName: string; type: string }

type BagSortMode = 'default' | 'rarity' | 'type' | 'quality'

type BagViewEntry = { item: BagItem; bagIndex: number }

const SLOT_LABELS: Record<string, string> = {
  head: 'Cabeça',
  chest: 'Peito',
  mainHand: 'Mão principal',
  offHand: 'Mão secundária',
  ring1: 'Anel',
  ring2: 'Anel 2',
  ring3: 'Anel 3',
  ring4: 'Anel 4',
  amulet: 'Amuleto',
  legs: 'Pernas',
  feet: 'Pés',
  hands: 'Mãos',
}

/** Tamanho visual base do slot (boxSize 1). boxSize N → base / N (máx. 4). */
const EQUIP_SLOT_BASE_REM = 6.5
const EQUIP_SLOT_MAX_BOX_SIZE = 4

const DRAG_MIME = 'application/x-skyspire-item'

function clampBoxSize(boxSize: number | undefined): number {
  const raw = Number.isFinite(boxSize) ? Math.round(boxSize as number) : 1
  return Math.min(EQUIP_SLOT_MAX_BOX_SIZE, Math.max(1, raw || 1))
}

function equipSlotStyle(boxSize: number | undefined): CSSProperties {
  const size = clampBoxSize(boxSize)
  return {
    ['--equip-slot-size' as string]: `${EQUIP_SLOT_BASE_REM / size}rem`,
  }
}

function itemTypeOf(item: BagItem): string {
  return item.type ?? 'material'
}

function resolveGhostInfoItem(
  equipment: Record<string, BagItem | null> | undefined,
  ghost: BagItem,
): BagItem {
  if (ghost.anchorSlot && equipment?.[ghost.anchorSlot] && !equipment[ghost.anchorSlot]?.ghost) {
    return equipment[ghost.anchorSlot]!
  }
  if (ghost.occupiedBy && equipment) {
    for (const item of Object.values(equipment)) {
      if (item && !item.ghost && item.instanceId === ghost.occupiedBy) return item
    }
  }
  return ghost
}

function starsLabel(stars?: number): string {
  if (!stars || stars < 1) return ''
  return '★'.repeat(Math.min(5, stars))
}

function itemMetaLine(item: BagItem, includeQty: boolean): string {
  const parts: string[] = []
  if (item.itemLevel) parts.push(`Lv${item.itemLevel}`)
  parts.push(item.rarityName ?? itemTypeOf(item))
  if (item.stars) parts.push(starsLabel(item.stars))
  if (includeQty && item.qty > 1) parts.push(`×${item.qty}`)
  return parts.join(' · ')
}

function compareLocale(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
}

/** Ordenação só visual — preserva bagIndex original para equip/discard. */
function sortBagForView(items: BagItem[], mode: BagSortMode): BagViewEntry[] {
  const entries = items.map((item, bagIndex) => ({ item, bagIndex }))
  if (mode === 'default') return entries

  return entries.sort((a, b) => {
    if (mode === 'rarity') {
      const rarityDiff = (b.item.rarityId ?? 0) - (a.item.rarityId ?? 0)
      if (rarityDiff !== 0) return rarityDiff
      return compareLocale(bagItemLabel(a.item), bagItemLabel(b.item))
    }
    if (mode === 'type') {
      const typeDiff = compareLocale(itemTypeOf(a.item), itemTypeOf(b.item))
      if (typeDiff !== 0) return typeDiff
      const rarityDiff = (b.item.rarityId ?? 0) - (a.item.rarityId ?? 0)
      if (rarityDiff !== 0) return rarityDiff
      return compareLocale(bagItemLabel(a.item), bagItemLabel(b.item))
    }
    // quality (estrelas)
    const qualityDiff = (b.item.stars ?? 0) - (a.item.stars ?? 0)
    if (qualityDiff !== 0) return qualityDiff
    const rarityDiff = (b.item.rarityId ?? 0) - (a.item.rarityId ?? 0)
    if (rarityDiff !== 0) return rarityDiff
    return compareLocale(bagItemLabel(a.item), bagItemLabel(b.item))
  })
}

export function InventoryPanel() {
  const { refreshCharacter } = useGameSession()
  const [data, setData] = useState<InventoryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [infoItem, setInfoItem] = useState<BagItem | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [dragging, setDragging] = useState<DragPayload | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [bagSort, setBagSort] = useState<BagSortMode>('default')
  const didDragRef = useRef(false)

  async function load() {
    try {
      setData(await apiGet<InventoryResponse>('/api/inventory', true))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function slotAccepts(slotName: string, type: string) {
    const slot = data?.equipmentSlots.find((s) => s.name === slotName)
    if (!slot) return false
    return slot.itemType.some(
      (allowed) => allowed === '*' || allowed.toLowerCase() === type.toLowerCase(),
    )
  }

  function readPayload(event: DragEvent): DragPayload | null {
    try {
      const raw = event.dataTransfer.getData(DRAG_MIME) || event.dataTransfer.getData('text/plain')
      if (!raw) return dragging
      return JSON.parse(raw) as DragPayload
    } catch {
      return dragging
    }
  }

  function startDrag(event: DragEvent, payload: DragPayload) {
    didDragRef.current = true
    event.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload))
    event.dataTransfer.setData('text/plain', JSON.stringify(payload))
    event.dataTransfer.effectAllowed = 'move'
    setDragging(payload)
    setError(null)
  }

  function endDrag() {
    setDragging(null)
    setDropTarget(null)
    // Keep didDrag until the next pointerup can see it, then clear.
    window.setTimeout(() => {
      didDragRef.current = false
    }, 0)
  }

  function openItemInfo(item: BagItem, event: PointerEvent) {
    if (event.button !== 0) return
    if (event.ctrlKey || event.metaKey) return
    if (didDragRef.current) return
    setInfoItem(item)
  }

  async function equip(bagIndex: number, slotName: string) {
    setError(null)
    setIsUpdating(true)
    try {
      setData(
        await apiPost<InventoryResponse>(
          '/api/inventory/equip',
          { bagIndex, slotName },
          true,
        ),
      )
      setSelectedItems([])
      void refreshCharacter()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao equipar')
    } finally {
      setIsUpdating(false)
    }
  }

  async function unequip(slot: string) {
    setError(null)
    setIsUpdating(true)
    try {
      setData(await apiPost<InventoryResponse>('/api/inventory/unequip', { slotName: slot }, true))
      setSelectedItems([])
      void refreshCharacter()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao desequipar')
    } finally {
      setIsUpdating(false)
    }
  }

  async function discard() {
    if (selectedItems.length === 0 || !data) return

    const labels = selectedItems
      .map((index) => data.items[index])
      .filter((item) => item !== undefined)
      .map((item) => (item.qty > 1 ? `${bagItemLabel(item)} x${item.qty}` : bagItemLabel(item)))

    if (labels.length === 0) {
      setSelectedItems([])
      return
    }

    const target = labels.length === 1 ? labels[0] : `${labels.length} itens:\n${labels.join('\n')}`
    if (!window.confirm(`Descartar ${target}\n\nEsta ação não pode ser desfeita.`)) {
      return
    }

    setError(null)
    setIsUpdating(true)
    try {
      setData(
        await apiPost<InventoryResponse>(
          '/api/inventory/discard',
          { bagIndexes: selectedItems },
          true,
        ),
      )
      setSelectedItems([])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao descartar itens')
    } finally {
      setIsUpdating(false)
    }
  }

  function toggleItem(index: number, event: MouseEvent) {
    const additive = event.ctrlKey || event.metaKey
    setSelectedItems((current) => {
      if (!additive) {
        return current.length === 1 && current[0] === index ? [] : [index]
      }
      return current.includes(index)
        ? current.filter((i) => i !== index)
        : [...current, index].sort((a, b) => a - b)
    })
  }

  function onSlotDragOver(event: DragEvent, slotName: string) {
    if (!dragging || dragging.source !== 'bag') return
    if (!slotAccepts(slotName, dragging.type)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (dropTarget !== slotName) setDropTarget(slotName)
  }

  function onSlotDrop(event: DragEvent, slotName: string) {
    event.preventDefault()
    const payload = readPayload(event)
    endDrag()
    if (!payload || payload.source !== 'bag' || isUpdating) return
    if (!slotAccepts(slotName, payload.type)) {
      setError(`Este item não encaixa em ${SLOT_LABELS[slotName] ?? slotName}.`)
      return
    }
    void equip(payload.bagIndex, slotName)
  }

  function onBagDragOver(event: DragEvent) {
    if (!dragging || dragging.source !== 'equip') return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (dropTarget !== 'bag') setDropTarget('bag')
  }

  function onBagDrop(event: DragEvent) {
    event.preventDefault()
    const payload = readPayload(event)
    endDrag()
    if (!payload || payload.source !== 'equip' || isUpdating) return
    void unequip(payload.slotName)
  }

  return (
    <section className="game-panel">
      <h1>Inventário</h1>
      <p className="hub__lead">
        Arraste um item da bag para um slot compatível. Arraste o item equipado de volta à bag para
        desequipar. Solte o clique no item para ver os atributos (raridade e estrelas).
      </p>
      {error ? <p className="form-error">{error}</p> : null}

      {!data ? (
        <p>Carregando…</p>
      ) : (
        <div className="inventory">
          <div className="inventory__column">
            <h2 className="game-panel__subtitle">Equipamentos</h2>
            <div className="equip-grid">
              {data.equipmentSlots.map((slot) => {
                const equipped = data.equipment?.[slot.name]
                const isGhost = Boolean(equipped?.ghost)
                const infoTarget =
                  isGhost && equipped
                    ? resolveGhostInfoItem(data.equipment, equipped)
                    : equipped
                const boxSize = clampBoxSize(slot.boxSize)
                const canDrop =
                  dragging?.source === 'bag' && slotAccepts(slot.name, dragging.type)
                const isTarget = dropTarget === slot.name && canDrop

                return (
                  <div
                    key={slot.name}
                    data-box-size={boxSize}
                    style={equipSlotStyle(boxSize)}
                    className={[
                      'equip-slot',
                      equipped ? 'equip-slot--filled' : 'equip-slot--empty',
                      isGhost ? 'equip-slot--ghost' : '',
                      canDrop ? 'equip-slot--can-drop' : '',
                      isTarget ? 'equip-slot--drop-target' : '',
                      dragging?.source === 'bag' && !canDrop ? 'equip-slot--blocked' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onDragOver={(event) => onSlotDragOver(event, slot.name)}
                    onDragLeave={() => {
                      if (dropTarget === slot.name) setDropTarget(null)
                    }}
                    onDrop={(event) => onSlotDrop(event, slot.name)}
                  >
                    {equipped ? (
                      <div
                        className={[
                          'item-tile',
                          'item-tile--in-slot',
                          isGhost ? 'item-tile--ghost' : '',
                          equipped.stars && !isGhost ? 'item-tile--quality' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        style={isGhost ? undefined : itemQualityStyle(equipped)}
                        draggable={!isUpdating}
                        onDragStart={(event) =>
                          startDrag(event, {
                            source: 'equip',
                            slotName: slot.name,
                            type: itemTypeOf(equipped),
                          })
                        }
                        onDragEnd={endDrag}
                        onPointerUp={(event) =>
                          openItemInfo(infoTarget ?? equipped, event)
                        }
                        title={
                          isGhost
                            ? 'Ocupado pela arma de duas mãos · arraste para a bag para desequipar'
                            : 'Arraste para a bag · solte o clique para atributos'
                        }
                      >
                        <ItemTileVisual
                          item={equipped}
                          meta={
                            isGhost
                              ? '2 mãos'
                              : itemMetaLine(equipped, false)
                          }
                        />
                      </div>
                    ) : (
                      <div className="equip-slot__placeholder">
                        <span className="equip-slot__label">
                          {SLOT_LABELS[slot.name] ?? slot.name}
                        </span>
                        <span className="equip-slot__hint">{slot.itemType.join(' · ')}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="inventory__column">
            <div className="inventory__bag-header">
              <h2 className="game-panel__subtitle">
                Bag ({data.items.length}/{data.slotCount})
              </h2>
              <label className="inventory__sort">
                <span className="inventory__sort-label">Ordenar bag</span>
                <select
                  className="inventory__sort-select"
                  value={bagSort}
                  disabled={data.items.length === 0 || isUpdating}
                  onChange={(event) => setBagSort(event.target.value as BagSortMode)}
                  aria-label="Ordenar bag"
                >
                  <option value="default">Padrão</option>
                  <option value="rarity">Raridade</option>
                  <option value="type">Tipo</option>
                  <option value="quality">Qualidade</option>
                </select>
              </label>
            </div>
            <div
              className={[
                'bag-dropzone',
                dropTarget === 'bag' && dragging?.source === 'equip' ? 'bag-dropzone--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onDragOver={onBagDragOver}
              onDragLeave={() => {
                if (dropTarget === 'bag') setDropTarget(null)
              }}
              onDrop={onBagDrop}
            >
              {data.items.length === 0 ? (
                <p className="inventory__empty">
                  {dragging?.source === 'equip'
                    ? 'Solte aqui para desequipar'
                    : 'A bag está vazia.'}
                </p>
              ) : (
                <div className="bag-grid">
                  {sortBagForView(data.items, bagSort).map(({ item, bagIndex }) => {
                    const selected = selectedItems.includes(bagIndex)
                    const isDragging =
                      dragging?.source === 'bag' && dragging.bagIndex === bagIndex
                    const showsUpgrade = bagItemShowsUpgradeArrow(
                      item,
                      data.equipment,
                      data.equipmentSlots,
                    )
                    return (
                      <div
                        key={item.instanceId ?? `${bagItemTemplateId(item)}-${bagIndex}`}
                        className={[
                          'item-tile',
                          item.stars ? 'item-tile--quality' : '',
                          selected ? 'item-tile--selected' : '',
                          isDragging ? 'item-tile--dragging' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        style={itemQualityStyle(item)}
                        draggable={!isUpdating}
                        onDragStart={(event) =>
                          startDrag(event, {
                            source: 'bag',
                            bagIndex,
                            type: itemTypeOf(item),
                          })
                        }
                        onDragEnd={endDrag}
                        onClick={(event) => toggleItem(bagIndex, event)}
                        onPointerUp={(event) => openItemInfo(item, event)}
                        title={
                          showsUpgrade
                            ? 'Melhor em algum atributo vs. um item equipado · arraste para um slot'
                            : 'Arraste para um slot · solte o clique para atributos · Ctrl+clique para selecionar'
                        }
                      >
                        {showsUpgrade ? (
                          <span className="item-tile__upgrade" aria-label="Upgrade de atributo">
                            ▲
                          </span>
                        ) : null}
                        <ItemTileVisual item={item} meta={itemMetaLine(item, true)} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {selectedItems.length > 0 ? (
              <div className="inventory__actions">
                <span className="inventory__selection">
                  {selectedItems.length === 1
                    ? '1 item selecionado'
                    : `${selectedItems.length} itens selecionados`}
                </span>
                <button
                  type="button"
                  className="btn inventory__discard"
                  onClick={() => void discard()}
                  disabled={isUpdating}
                >
                  {selectedItems.length === 1 ? 'Descartar item' : 'Descartar selecionados'}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setSelectedItems([])}
                  disabled={isUpdating}
                >
                  Limpar seleção
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {infoItem ? <ItemInfoModal item={infoItem} onClose={() => setInfoItem(null)} /> : null}
    </section>
  )
}
