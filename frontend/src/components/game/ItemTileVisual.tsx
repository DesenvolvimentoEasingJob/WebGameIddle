import { useState } from 'react'
import { resolveItemIconUrl } from '../../game/itemAssets'
import { bagItemTemplateId, type BagItem } from '../../types/item'

type Props = {
  item: BagItem
  /** Extra meta line (rarity / stars / qty) when falling back to text. */
  meta: string
}

/**
 * Inventory tile face: asset icon when registered and loadable; otherwise name + meta.
 */
export function ItemTileVisual({ item, meta }: Props) {
  const iconUrl = resolveItemIconUrl(item.assets?.icon)
  const [broken, setBroken] = useState(false)
  const showIcon = Boolean(iconUrl) && !broken
  const label = item.name ?? bagItemTemplateId(item)
  const rarity = item.rarityName?.trim() || null

  if (showIcon && iconUrl) {
    return (
      <>
        <img
          className="item-tile__icon"
          src={iconUrl}
          alt={label}
          draggable={false}
          onError={() => setBroken(true)}
        />
        {rarity ? (
          <span className="item-tile__rarity" title={rarity}>
            {rarity}
          </span>
        ) : null}
        {item.qty > 1 ? <span className="item-tile__qty">×{item.qty}</span> : null}
      </>
    )
  }

  return (
    <>
      <span className="item-tile__name">{label}</span>
      {meta ? <span className="item-tile__meta">{meta}</span> : null}
      {rarity ? (
        <span className="item-tile__rarity" title={rarity}>
          {rarity}
        </span>
      ) : null}
    </>
  )
}
