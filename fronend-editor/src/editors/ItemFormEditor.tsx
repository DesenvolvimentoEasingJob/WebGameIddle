import { useMemo, useState } from 'react'
import {
  GRIP_OPTIONS,
  HAND_ITEM_TYPES,
  ITEM_TYPES,
  STAT_SUGGESTIONS,
  stackableStatsWarning,
  type ItemFormData,
  type ItemGrip,
} from '../lib/itemModel'

interface ItemFormEditorProps {
  value: ItemFormData
  idLocked: boolean
  onChange: (next: ItemFormData) => void
  onGenerateIcon?: () => void
  iconBusy?: boolean
  apiBase?: string
  /** Cache-bust query for /api/assets/items/... (same filename after regenerate). */
  previewBurst?: number
}

export function ItemFormEditor({
  value,
  idLocked,
  onChange,
  onGenerateIcon,
  iconBusy = false,
  apiBase = '',
  previewBurst = 0,
}: ItemFormEditorProps) {
  const [statKey, setStatKey] = useState('')
  const [statValue, setStatValue] = useState('0')
  const warning = useMemo(() => stackableStatsWarning(value), [value])

  function patch(partial: Partial<ItemFormData>) {
    onChange({ ...value, ...partial })
  }

  function addStat() {
    const key = statKey.trim()
    if (!key) return
    const num = Number(statValue)
    if (!Number.isFinite(num)) return
    patch({ stats: { ...value.stats, [key]: num } })
    setStatKey('')
    setStatValue('0')
  }

  function removeStat(key: string) {
    const next = { ...value.stats }
    delete next[key]
    patch({ stats: next })
  }

  const previewSrc = useMemo(
    () => resolveIconPreview(value.assets.icon, apiBase, previewBurst),
    [value.assets.icon, apiBase, previewBurst],
  )

  return (
    <div className="item-form">
      <div className="item-form__grid">
        <label className="field">
          <span className="field__label">id</span>
          <input
            type="text"
            value={value.id}
            disabled={idLocked}
            placeholder="ex.: iron-sword"
            onChange={(e) => patch({ id: e.target.value })}
          />
        </label>

        <label className="field">
          <span className="field__label">nome</span>
          <input
            type="text"
            value={value.name}
            placeholder="Nome do item"
            onChange={(e) => patch({ name: e.target.value })}
          />
        </label>

        <label className="field item-form__full">
          <span className="field__label">descrição</span>
          <textarea
            rows={3}
            value={value.description}
            placeholder="Descrição curta para o inventário"
            onChange={(e) => patch({ description: e.target.value })}
          />
        </label>

        <label className="field">
          <span className="field__label">tipo</span>
          <select
            value={value.type}
            onChange={(e) => {
              const type = e.target.value
              const next: Partial<ItemFormData> = { type }
              if (HAND_ITEM_TYPES.has(type)) {
                next.grip = value.grip === 'twoHand' ? 'twoHand' : 'oneHand'
              } else {
                next.grip = undefined
              }
              patch(next)
            }}
          >
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            {!ITEM_TYPES.includes(value.type as (typeof ITEM_TYPES)[number]) && value.type ? (
              <option value={value.type}>{value.type} (custom)</option>
            ) : null}
          </select>
        </label>

        {HAND_ITEM_TYPES.has(value.type) ? (
          <label className="field">
            <span className="field__label">grip (mãos)</span>
            <select
              value={value.grip ?? 'oneHand'}
              onChange={(e) => patch({ grip: e.target.value as ItemGrip })}
            >
              {GRIP_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g === 'oneHand' ? 'oneHand (1 slot)' : 'twoHand (2 slots)'}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="field">
          <span className="field__label">itemLevel</span>
          <input
            type="number"
            min={1}
            value={value.itemLevel}
            onChange={(e) => patch({ itemLevel: Number(e.target.value) })}
          />
        </label>

        <label className="field field--checkbox">
          <span className="field__label">stackable</span>
          <span className="jse-bool">
            <input
              type="checkbox"
              checked={value.stackable}
              onChange={(e) => patch({ stackable: e.target.checked })}
            />
            {value.stackable ? 'true' : 'false'}
          </span>
        </label>
      </div>

      {warning && <p className="notice badge--warn-text">{warning}</p>}

      <section className="item-form__section">
        <header className="item-form__section-head">
          <h3>Stats</h3>
          <p className="muted small">Atributos base do template (raridade é rolada no drop).</p>
        </header>

        <ul className="item-stats">
          {Object.entries(value.stats).map(([key, num]) => (
            <li key={key} className="item-stats__row">
              <code>{key}</code>
              <input
                type="number"
                className="jse-value--num"
                value={num}
                onChange={(e) =>
                  patch({
                    stats: { ...value.stats, [key]: Number(e.target.value) },
                  })
                }
              />
              <button type="button" className="jse-remove" onClick={() => removeStat(key)} title="Remover">
                ×
              </button>
            </li>
          ))}
          {Object.keys(value.stats).length === 0 && (
            <li className="muted small">Nenhum atributo — materiais costumam ficar vazios.</li>
          )}
        </ul>

        <div className="item-stats__add">
          <input
            type="text"
            list="item-stat-suggestions"
            placeholder="chave (ex.: dmgBase)"
            value={statKey}
            onChange={(e) => setStatKey(e.target.value)}
          />
          <datalist id="item-stat-suggestions">
            {STAT_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <input
            type="number"
            value={statValue}
            onChange={(e) => setStatValue(e.target.value)}
          />
          <button type="button" className="btn" onClick={addStat}>
            + Atributo
          </button>
        </div>
      </section>

      <section className="item-form__section">
        <header className="item-form__section-head">
          <h3>Ícone</h3>
          <p className="muted small">
            Path em assets.icon — PixelLab Standard (pixflux) ou Pro (generate-image-v2).
          </p>
        </header>
        <div className="item-icon-row">
          <label className="field item-icon-row__path">
            <span className="field__label">assets.icon</span>
            <input
              type="text"
              value={value.assets.icon}
              onChange={(e) => patch({ assets: { icon: e.target.value } })}
            />
          </label>
          {onGenerateIcon && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={onGenerateIcon}
              disabled={iconBusy || !value.id.trim()}
              title={!value.id.trim() ? 'Defina o id antes' : undefined}
            >
              {iconBusy ? 'Gerando…' : 'Gerar ícone'}
            </button>
          )}
          <div className="item-icon-preview">
            {previewSrc ? (
              <img key={previewSrc} src={previewSrc} alt="" width={64} height={64} />
            ) : (
              <span className="muted small">sem preview</span>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

/** Absolute preview URL for item icons (`/api/assets/items/...` or `/assets/items/...`). */
export function resolveIconPreview(
  icon: string,
  apiBase: string,
  cacheBust = 0,
): string | null {
  const path = icon.trim()
  if (!path) return null

  let url: string
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    if (!cacheBust || path.startsWith('data:')) return path
    const sep = path.includes('?') ? '&' : '?'
    return `${path}${sep}v=${cacheBust}`
  }
  if (path.startsWith('/api/')) {
    url = `${apiBase.replace(/\/$/, '')}${path}`
  } else {
    const m = path.match(/^\/assets\/items\/([^/]+\.(?:png|webp|gif))$/i)
    if (m) {
      url = `${apiBase.replace(/\/$/, '')}/api/assets/items/${m[1]}`
    } else {
      url = path
    }
  }

  if (!cacheBust) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}v=${cacheBust}`
}
