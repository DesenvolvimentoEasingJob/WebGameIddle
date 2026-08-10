import { useEffect, useMemo, useState } from 'react'
import {
  floorNumberFromId,
  MAX_ENEMIES_PER_ROOM,
  syncNumberFromId,
  type FloorFormData,
  type FloorRoomForm,
} from '../lib/floorModel'

/** Absolute preview URL with cache-bust query (same path after regenerate). */
function resolveBackgroundPreview(
  path: string,
  apiBase: string,
  cacheBust: number,
): string | null {
  const p = path.trim()
  if (!p) return null

  let apiPath = p
  if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:')) {
    if (!cacheBust || p.startsWith('data:')) return p
    const sep = p.includes('?') ? '&' : '?'
    return `${p}${sep}v=${cacheBust}`
  }

  // Content may store /assets/floors/... or /api/assets/floors/...
  if (p.startsWith('/assets/floors/')) {
    apiPath = `/api/assets/floors/${p.slice('/assets/floors/'.length)}`
  } else if (!p.startsWith('/api/')) {
    const fileName = p.split('/').pop()
    if (!fileName) return null
    apiPath = `/api/assets/floors/${fileName}`
  }

  const base = apiBase.replace(/\/$/, '')
  const url = `${base}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`
  if (!cacheBust) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}v=${cacheBust}`
}

export interface MonsterOption {
  id: string
  name: string
}

interface FloorFormEditorProps {
  value: FloorFormData
  idLocked: boolean
  monsterOptions: MonsterOption[]
  onChange: (next: FloorFormData) => void
  onGenerateBackground?: () => void
  backgroundBusy?: boolean
  apiBase?: string
  previewBurst?: number
}

type RoomTab = number | 'boss'

export function FloorFormEditor({
  value,
  idLocked,
  monsterOptions,
  onChange,
  onGenerateBackground,
  backgroundBusy = false,
  apiBase = '',
  previewBurst = 0,
}: FloorFormEditorProps) {
  const [tab, setTab] = useState<RoomTab>(1)
  const [pickId, setPickId] = useState('')
  const [previewBroken, setPreviewBroken] = useState(false)

  const previewSrc = useMemo(
    () => resolveBackgroundPreview(value.assets.background, apiBase, previewBurst),
    [value.assets.background, apiBase, previewBurst],
  )

  // Same asset path after regenerate — reset broken flag when URL bust changes.
  useEffect(() => {
    setPreviewBroken(false)
  }, [value.assets.background, previewBurst])

  function patch(partial: Partial<FloorFormData>) {
    onChange({ ...value, ...partial })
  }

  function onIdChange(raw: string) {
    const next = syncNumberFromId({ ...value, id: raw })
    onChange(next)
  }

  const idNumber = floorNumberFromId(value.id.trim())
  const numberMismatch = idNumber != null && idNumber !== value.number

  const activeRoom: FloorRoomForm | null =
    typeof tab === 'number' ? (value.rooms.find((r) => r.number === tab) ?? null) : null

  const sortedOptions = useMemo(
    () =>
      [...monsterOptions].sort((a, b) =>
        a.id.localeCompare(b.id, undefined, { sensitivity: 'base' }),
      ),
    [monsterOptions],
  )

  function updateRoom(roomNumber: number, monsterIds: string[]) {
    patch({
      rooms: value.rooms.map((r) =>
        r.number === roomNumber ? { ...r, type: 'wave', monsterIds } : r,
      ),
    })
  }

  function addMonsterToRoom(roomNumber: number) {
    const id = pickId.trim()
    if (!id) return
    const room = value.rooms.find((r) => r.number === roomNumber)
    if (!room) return
    updateRoom(roomNumber, [...room.monsterIds, id])
    setPickId('')
  }

  function removeMonsterFromRoom(roomNumber: number, index: number) {
    const room = value.rooms.find((r) => r.number === roomNumber)
    if (!room) return
    updateRoom(
      roomNumber,
      room.monsterIds.filter((_, i) => i !== index),
    )
  }

  return (
    <div className="item-form floor-form">
      <div className="item-form__grid">
        <label className="field">
          <span className="field__label">id</span>
          <input
            type="text"
            value={value.id}
            disabled={idLocked}
            placeholder="floor-01"
            onChange={(e) => onIdChange(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">number</span>
          <input
            type="number"
            min={1}
            max={99}
            value={value.number}
            onChange={(e) => patch({ number: Number(e.target.value) })}
          />
          {numberMismatch && (
            <span className="field__hint field__hint--warn">
              Diverge do id (esperado {idNumber}). Salvar sincroniza pelo id.
            </span>
          )}
        </label>

        <label className="field">
          <span className="field__label">nome</span>
          <input
            type="text"
            value={value.name}
            placeholder="Nome do andar"
            onChange={(e) => patch({ name: e.target.value })}
          />
        </label>

        <label className="field">
          <span className="field__label">theme</span>
          <input
            type="text"
            value={value.theme}
            placeholder="ex.: dungeon-moss"
            onChange={(e) => patch({ theme: e.target.value })}
          />
        </label>

        <label className="field item-form__full">
          <span className="field__label">descrição (brief visual)</span>
          <textarea
            rows={5}
            value={value.description}
            placeholder="Aparência do andar para arte: cores, luz, arquitetura, atmosfera, materiais…"
            onChange={(e) => patch({ description: e.target.value })}
          />
          <span className="field__hint">
            Usada no flavor e no prompt Gemini do background — seja específico (luz, paleta, formas).
          </span>
        </label>

        <label className="field item-form__full">
          <span className="field__label">complemento generativo (opcional)</span>
          <textarea
            rows={3}
            value={value.generativeComplement}
            placeholder="Extras só deste andar — acrescenta ao floorImageComplement global (Config), ex.: more moss glow, colder teal mist…"
            onChange={(e) => patch({ generativeComplement: e.target.value })}
          />
          <span className="field__hint">
            O padrão 21:9 / chão embaixo / side view fica no Config → floorImageComplement.
          </span>
        </label>

        <label className="field">
          <span className="field__label">difficulty</span>
          <input
            type="number"
            min={1}
            value={value.difficulty}
            onChange={(e) => patch({ difficulty: Number(e.target.value) })}
          />
        </label>

        <label className="field">
          <span className="field__label">itemLevel</span>
          <input
            type="number"
            min={1}
            value={value.itemLevel}
            onChange={(e) => patch({ itemLevel: Number(e.target.value) })}
          />
        </label>

        <label className="field">
          <span className="field__label">ownerPlayerId</span>
          <input type="text" value={value.ownerPlayerId ?? ''} disabled readOnly />
        </label>

        <label className="field">
          <span className="field__label">ownerSnapshotPath</span>
          <input type="text" value={value.ownerSnapshotPath ?? ''} disabled readOnly />
        </label>
      </div>

      <section className="item-form__section">
        <header className="item-form__section-head">
          <h3>Background (Gemini)</h3>
          <p className="muted small">
            Gera PNG ultrawide 21:9 (arena de combate) em <code>data/assets/floors/</code> a partir
            do nome, theme e descrição.
          </p>
        </header>
        <div className="floor-bg-row">
          <label className="field floor-bg-row__path">
            <span className="field__label">assets.background</span>
            <input
              type="text"
              value={value.assets.background}
              placeholder="/api/assets/floors/floor-01.png"
              onChange={(e) => {
                setPreviewBroken(false)
                patch({ assets: { background: e.target.value } })
              }}
            />
          </label>
          {onGenerateBackground && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={onGenerateBackground}
              disabled={backgroundBusy || !value.id.trim()}
              title={!value.id.trim() ? 'Defina o id antes' : undefined}
            >
              {backgroundBusy ? 'Gerando…' : 'Gerar background (Gemini)'}
            </button>
          )}
        </div>
        <div className="floor-bg-preview">
          {previewSrc && !previewBroken ? (
            <img
              key={previewSrc}
              src={previewSrc}
              alt=""
              onLoad={() => setPreviewBroken(false)}
              onError={() => setPreviewBroken(true)}
            />
          ) : (
            <span className="muted small">
              {previewBroken
                ? 'Preview indisponível — gere o background ou confira a API.'
                : 'sem preview'}
            </span>
          )}
        </div>
      </section>

      <section className="item-form__section">
        <header className="item-form__section-head">
          <h3>Salas e chefe</h3>
          <p className="muted small">
            9 salas de farm + boss. Cada entrada em <code>monsterIds</code> é um inimigo na luta
            (quantidade = tamanho da lista; pode repetir ou misturar tipos). Máx.{' '}
            {MAX_ENEMIES_PER_ROOM} por sala.
          </p>
        </header>

        <div className="floor-room-tabs" role="tablist" aria-label="Salas do andar">
          {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => {
            const room = value.rooms.find((r) => r.number === n)
            const count = room?.monsterIds.length ?? 0
            return (
              <button
                key={n}
                type="button"
                role="tab"
                aria-selected={tab === n}
                className={tab === n ? 'floor-room-tab is-active' : 'floor-room-tab'}
                onClick={() => setTab(n)}
              >
                {n}
                {count > 0 && <span className="floor-room-tab__badge">{count}</span>}
              </button>
            )
          })}
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'boss'}
            className={
              tab === 'boss' ? 'floor-room-tab floor-room-tab--boss is-active' : 'floor-room-tab floor-room-tab--boss'
            }
            onClick={() => setTab('boss')}
          >
            Boss
          </button>
        </div>

        {activeRoom && (
          <div className="floor-room-panel">
            <p className="muted small">
              Sala {activeRoom.number} · type <code>wave</code> ·{' '}
              <strong>{activeRoom.monsterIds.length}</strong> inimigo(s) no spawn
              {activeRoom.monsterIds.length >= MAX_ENEMIES_PER_ROOM ? ' (máximo)' : ''}
            </p>

            <ul className="floor-mob-chips">
              {activeRoom.monsterIds.map((mid, index) => (
                <li key={`${mid}-${index}`} className="floor-mob-chip">
                  <span className="floor-mob-chip__slot">#{index + 1}</span>
                  <code>{mid}</code>
                  <button
                    type="button"
                    className="jse-remove"
                    title="Remover slot"
                    onClick={() => removeMonsterFromRoom(activeRoom.number, index)}
                  >
                    ×
                  </button>
                </li>
              ))}
              {activeRoom.monsterIds.length === 0 && (
                <li className="muted small">Nenhum monstro — adicione slots de spawn.</li>
              )}
            </ul>

            <div className="floor-mob-add">
              <select
                value={pickId}
                onChange={(e) => setPickId(e.target.value)}
                disabled={activeRoom.monsterIds.length >= MAX_ENEMIES_PER_ROOM}
              >
                <option value="">Adicionar slot de monstro…</option>
                {sortedOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                    {m.name ? ` — ${m.name}` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn"
                disabled={
                  !pickId || activeRoom.monsterIds.length >= MAX_ENEMIES_PER_ROOM
                }
                onClick={() => addMonsterToRoom(activeRoom.number)}
              >
                Adicionar
              </button>
            </div>
          </div>
        )}

        {tab === 'boss' && (
          <div className="floor-room-panel item-form__grid">
            <label className="field item-form__full">
              <span className="field__label">boss.monsterId</span>
              <select
                value={value.boss.monsterId}
                onChange={(e) =>
                  patch({ boss: { ...value.boss, monsterId: e.target.value } })
                }
              >
                <option value="">Selecionar chefe…</option>
                {sortedOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                    {m.name ? ` — ${m.name}` : ''}
                  </option>
                ))}
                {value.boss.monsterId &&
                  !sortedOptions.some((m) => m.id === value.boss.monsterId) && (
                    <option value={value.boss.monsterId}>
                      {value.boss.monsterId} (ausente)
                    </option>
                  )}
              </select>
            </label>

            <label className="field">
              <span className="field__label">gateFee</span>
              <input
                type="number"
                min={0}
                value={value.boss.gateFee}
                onChange={(e) =>
                  patch({ boss: { ...value.boss, gateFee: Number(e.target.value) } })
                }
              />
            </label>

            <label className="field">
              <span className="field__label">registryFee</span>
              <input
                type="number"
                min={0}
                value={value.boss.registryFee}
                onChange={(e) =>
                  patch({ boss: { ...value.boss, registryFee: Number(e.target.value) } })
                }
              />
            </label>

            <label className="field">
              <span className="field__label">attrMult</span>
              <input
                type="number"
                min={1}
                value={value.boss.attrMult}
                onChange={(e) =>
                  patch({ boss: { ...value.boss, attrMult: Number(e.target.value) } })
                }
              />
            </label>
          </div>
        )}
      </section>
    </div>
  )
}
