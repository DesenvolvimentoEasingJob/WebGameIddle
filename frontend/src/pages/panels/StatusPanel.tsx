import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react'
import { Navigate } from 'react-router-dom'
import { listRaces } from '../../api/content'
import { fetchInventory, type InventoryResponse } from '../../api/inventory'
import { ItemInfoModal } from '../../components/game/ItemInfoModal'
import { ItemTileVisual } from '../../components/game/ItemTileVisual'
import { useGameSession } from '../../game/GameSessionContext'
import {
  clampEquipBoxSize,
  equipSlotLabel,
  equipSlotSizeRem,
  groupEquipSlotsByRow,
} from '../../game/equipLayout'
import { itemQualityStyle } from '../../game/itemQuality'
import { resolveRacePortraitUrl } from '../../game/raceAssets'
import { formatStatForKey, groupStats, statLabel } from '../../game/stats'
import type { BagItem } from '../../types/item'

const EQUIP_SLOT_BASE_REM = 5.25

function equipSlotStyle(boxSize: number | undefined): CSSProperties {
  return {
    ['--equip-slot-size' as string]: `${equipSlotSizeRem(boxSize, EQUIP_SLOT_BASE_REM)}rem`,
  }
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

function itemMetaLine(item: BagItem): string {
  const parts: string[] = []
  if (item.unique) parts.push('Único')
  if (item.itemLevel) parts.push(`Lv${item.itemLevel}`)
  parts.push(item.rarityName ?? item.type ?? 'item')
  if (item.stars) parts.push(starsLabel(item.stars))
  return parts.join(' · ')
}

export function StatusPanel() {
  const { state, skyCoin, character, stats, characterMissing, inventoryRevision } =
    useGameSession()
  const [inventory, setInventory] = useState<InventoryResponse | null>(null)
  const [racePortrait, setRacePortrait] = useState<string | null>(null)
  const [raceName, setRaceName] = useState<string | null>(null)
  const [portraitBroken, setPortraitBroken] = useState(false)
  const [infoItem, setInfoItem] = useState<BagItem | null>(null)
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (characterMissing) return
    let cancelled = false
    void fetchInventory()
      .then((data) => {
        if (!cancelled) setInventory(data)
      })
      .catch(() => {
        if (!cancelled) setInventory(null)
      })
    return () => {
      cancelled = true
    }
  }, [inventoryRevision, characterMissing])

  useEffect(() => {
    const raceId = character?.raceId
    if (!raceId) {
      setRacePortrait(null)
      setRaceName(null)
      return
    }
    let cancelled = false
    setPortraitBroken(false)
    void listRaces()
      .then((races) => {
        if (cancelled) return
        const race = races.find((r) => r.id === raceId)
        setRaceName(race?.name ?? raceId)
        setRacePortrait(resolveRacePortraitUrl(race?.assets?.portrait ?? null))
      })
      .catch(() => {
        if (!cancelled) {
          setRaceName(raceId)
          setRacePortrait(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [character?.raceId])

  if (characterMissing) {
    return <Navigate to="/create/race" replace />
  }

  function openItemInfo(item: BagItem, event: PointerEvent) {
    const down = pointerDownRef.current
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) return
    setInfoItem(item)
  }

  const rows = inventory ? groupEquipSlotsByRow(inventory.equipmentSlots) : []
  const statGroups = stats && Object.keys(stats).length > 0 ? groupStats(stats) : []

  return (
    <section className="game-panel">
      <h1>Status</h1>
      <p className="hub__lead">Equipamento e atributos do personagem.</p>
      {!character ? (
        <p>Carregando…</p>
      ) : (
        <div className="status-panel__layout">
          <div className="status-panel__doll">
            <h2 className="game-panel__subtitle">Equipamento</h2>
            {!inventory ? (
              <p className="hub__lead">Carregando equipamentos…</p>
            ) : rows.length === 0 ? (
              <p className="hub__lead">Nenhum slot de equipamento.</p>
            ) : (
              <div className="status-doll" aria-label="Paper doll de equipamentos">
                {rows.map(({ row, slots }) => (
                  <div key={row} className="status-doll__row">
                    {slots.map((slot) => {
                      const equipped = inventory.equipment?.[slot.name] ?? null
                      const isGhost = Boolean(equipped?.ghost)
                      const infoTarget =
                        isGhost && equipped
                          ? resolveGhostInfoItem(inventory.equipment, equipped)
                          : equipped
                      const boxSize = clampEquipBoxSize(slot.boxSize)

                      return (
                        <div
                          key={slot.name}
                          data-box-size={boxSize}
                          style={equipSlotStyle(boxSize)}
                          className={[
                            'equip-slot',
                            'status-doll__slot',
                            equipped ? 'equip-slot--filled' : 'equip-slot--empty',
                            isGhost ? 'equip-slot--ghost' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          title={equipSlotLabel(slot.name)}
                        >
                          {equipped ? (
                            <button
                              type="button"
                              className={[
                                'item-tile',
                                'item-tile--in-slot',
                                'status-doll__item-btn',
                                isGhost ? 'item-tile--ghost' : '',
                                equipped.stars && !isGhost ? 'item-tile--quality' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              style={isGhost ? undefined : itemQualityStyle(equipped)}
                              onPointerDown={(event) => {
                                pointerDownRef.current = {
                                  x: event.clientX,
                                  y: event.clientY,
                                }
                              }}
                              onPointerUp={(event) =>
                                openItemInfo(infoTarget ?? equipped, event)
                              }
                            >
                              <ItemTileVisual
                                item={equipped}
                                meta={isGhost ? '2 mãos' : itemMetaLine(equipped)}
                              />
                            </button>
                          ) : (
                            <div className="equip-slot__placeholder">
                              <span className="equip-slot__label">
                                {equipSlotLabel(slot.name)}
                              </span>
                              <span className="equip-slot__hint">
                                {slot.itemType.join(' / ')}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="status-panel__aside">
            <div className="status-panel__identity-card">
              <div className="status-panel__portrait">
                {racePortrait && !portraitBroken ? (
                  <img
                    src={racePortrait}
                    alt={raceName ?? character.raceId}
                    className="status-panel__portrait-img"
                    onError={() => setPortraitBroken(true)}
                  />
                ) : (
                  <div className="status-panel__portrait-fallback" aria-hidden>
                    {(character.name || '?').slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="status-panel__identity">
                <div className="status-panel__name">
                  <strong>{character.name}</strong>
                  <span>Nv. {state?.level ?? character.level}</span>
                </div>
                <div>
                  {raceName ?? character.raceId} · {character.classId}
                </div>
                <div>
                  XP: {(state?.xp ?? character.xp).toLocaleString('pt-BR')} /{' '}
                  {(state?.xpToNextLevel ?? character.xpToNextLevel).toLocaleString('pt-BR')}
                </div>
                <div>
                  SkyCoin: {(skyCoin ?? character.skyCoin).toLocaleString('pt-BR')}
                </div>
              </div>
            </div>

            <h2 className="game-panel__subtitle status-panel__attrs-title">Atributos</h2>
            {statGroups.length === 0 ? (
              <p className="hub__lead">Nenhum atributo retornado.</p>
            ) : (
              <div className="status-panel__stat-groups">
                {statGroups.map((group) => (
                  <div key={group.id} className="status-panel__stat-group">
                    <h3 className="status-panel__stat-group-title">{group.title}</h3>
                    <div className="status-panel__stats">
                      {group.entries.map(([key, value]) => (
                        <div key={key} className="status-panel__stat">
                          <span className="status-panel__stat-label">{statLabel(key)}</span>
                          <strong>{formatStatForKey(key, value)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {infoItem ? <ItemInfoModal item={infoItem} onClose={() => setInfoItem(null)} /> : null}
    </section>
  )
}
