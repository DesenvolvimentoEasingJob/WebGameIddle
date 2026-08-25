import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { resolveItemIconUrl } from '../../game/itemAssets'
import { formatStatDelta, sortStats, statLabel } from '../../game/stats'
import type { UniqueDropPreview } from '../../types/api'

type Props = {
  item: UniqueDropPreview
  remaining: number
  onClose: () => void
}

const TYPE_LABELS: Record<string, string> = {
  weapon: 'Arma',
  helmet: 'Elmo',
  armor: 'Armadura',
  focus: 'Foco',
  ring: 'Anel',
  amulet: 'Amuleto',
  shield: 'Escudo',
}

export function UniqueDropModal({ item, remaining, onClose }: Props) {
  const iconUrl = resolveItemIconUrl(item.icon)
  const [iconBroken, setIconBroken] = useState(false)
  const showIcon = Boolean(iconUrl) && !iconBroken
  const stats = item.stats ? sortStats(item.stats) : []
  const typeLabel = TYPE_LABELS[item.type ?? ''] ?? item.type ?? 'item'
  const stars = item.stars ? '★'.repeat(Math.min(5, item.stars)) : null

  useEffect(() => {
    setIconBroken(false)
  }, [iconUrl])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div className="modal unique-drop-modal" role="presentation">
      <div
        className="modal__card modal__card--item unique-drop-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unique-drop-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="unique-drop-modal__eyebrow">Item único</p>
        <h2 id="unique-drop-title" className="modal__title modal__title--item">
          {item.name}
        </h2>
        <p className="modal__subtitle">
          {[typeLabel, item.rarityName ?? null, stars, item.itemLevel ? `Nível ${item.itemLevel}` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>

        <div className="unique-drop-modal__body">
          {showIcon && iconUrl ? (
            <img
              className="unique-drop-modal__icon"
              src={iconUrl}
              alt=""
              draggable={false}
              onError={() => setIconBroken(true)}
            />
          ) : (
            <div className="unique-drop-modal__icon unique-drop-modal__icon--empty" aria-hidden />
          )}
          <div className="unique-drop-modal__copy">
            {item.description ? (
              <p className="modal__text">{item.description}</p>
            ) : null}
            {item.lore ? <p className="modal__text unique-drop-modal__lore">{item.lore}</p> : null}
            {stats.length > 0 ? (
              <dl className="item-stats">
                {stats.map(([key, value]) => (
                  <div key={key} className="item-stats__row">
                    <dt>{statLabel(key)}</dt>
                    <dd>{formatStatDelta(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </div>

        <p className="unique-drop-modal__hint muted small">
          Farm automático desligado.
          {remaining > 0 ? ` Mais ${remaining} único(s) nesta luta.` : ''}
        </p>

        <div className="modal__actions">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Continuar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
