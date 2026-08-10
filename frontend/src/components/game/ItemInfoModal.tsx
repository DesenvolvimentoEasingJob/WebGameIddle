import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { resolveItemIconUrl } from '../../game/itemAssets'
import { formatStatDelta, sortStats, statLabel } from '../../game/stats'
import { itemQualityStyle, resolveItemQuality } from '../../game/itemQuality'
import { bagItemLabel, bagItemTemplateId, type BagItem } from '../../types/item'

type Props = {
  item: BagItem
  onClose: () => void
}

const TYPE_LABELS: Record<string, string> = {
  weapon: 'Arma',
  helmet: 'Elmo',
  armor: 'Armadura',
  focus: 'Foco',
  ring: 'Anel',
  amulet: 'Amuleto',
  material: 'Material',
  consumable: 'Consumível',
  shield: 'Escudo',
}

const GRIP_LABELS: Record<string, string> = {
  oneHand: 'Uma mão',
  twoHand: 'Duas mãos',
}

export function ItemInfoModal({ item, onClose }: Props) {
  const iconUrl = resolveItemIconUrl(item.assets?.icon)
  const [iconBroken, setIconBroken] = useState(false)
  const showIcon = Boolean(iconUrl) && !iconBroken

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

  const title = item.name ?? bagItemTemplateId(item)
  const stats = item.stats ? sortStats(item.stats) : []
  const typeLabel = TYPE_LABELS[item.type ?? ''] ?? item.type ?? 'item'
  const stars = item.stars ? '★'.repeat(Math.min(5, item.stars)) : null
  const quality = resolveItemQuality(item)
  const qualityStyle = itemQualityStyle(item)

  return createPortal(
    <div className="modal" role="presentation" onClick={onClose}>
      <div
        className={[
          'modal__card',
          'modal__card--item',
          quality ? 'modal__card--item-quality' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={qualityStyle}
        role="dialog"
        aria-modal="true"
        aria-label={`Atributos de ${bagItemLabel(item)}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal__close" onClick={onClose} aria-label="Fechar">
          ×
        </button>

        <div className="item-modal__top">
          <div className="item-modal__copy">
            <h2 className="modal__title modal__title--item">{title}</h2>
            <p className="modal__subtitle">
              {[
                typeLabel,
                item.grip ? GRIP_LABELS[item.grip] ?? item.grip : null,
                item.rarityName ?? null,
                quality?.name ?? null,
                stars,
                item.itemLevel ? `Nível ${item.itemLevel}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {item.description ? (
              <p className="modal__text item-modal__description">{item.description}</p>
            ) : (
              <p className="modal__text modal__text--muted item-modal__description">
                Sem descrição.
              </p>
            )}
          </div>

          {showIcon && iconUrl ? (
            <img
              className="item-modal__icon"
              src={iconUrl}
              alt=""
              draggable={false}
              onError={() => setIconBroken(true)}
            />
          ) : null}
        </div>

        <h3 className="modal__section">Atributos</h3>
        {stats.length === 0 ? (
          <p className="modal__text modal__text--muted">Este item não concede atributos.</p>
        ) : (
          <dl className="item-stats">
            {stats.map(([key, value]) => (
              <div key={key} className="item-stats__row">
                <dt>{statLabel(key)}</dt>
                <dd>{formatStatDelta(value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>,
    document.body,
  )
}
