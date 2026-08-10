import { useEffect, useState, type CSSProperties } from 'react'
import {
  resolveMonsterIdleFrameUrls,
  resolveMonsterSpriteUrl,
} from '../../game/monsterAssets'
import type { MonsterIdleAnimation } from '../../types/api'

const DEFAULT_DISPLAY_SIZE = 56

type MonsterCombatSpriteProps = {
  sprite?: string | null
  idle?: MonsterIdleAnimation | null
  /** Presentation width from content `assets.width` (px). */
  width?: number | null
  /** Presentation height from content `assets.height` (px). */
  height?: number | null
  dead?: boolean
  className?: string
}

/**
 * Combat-footer mob art.
 * Layout footprint stays in a fixed slot; the visual is absolute + bottom-centered
 * so assets.width/height scale without breaking the dock grid.
 */
export function MonsterCombatSprite({
  sprite,
  idle,
  width,
  height,
  dead = false,
  className = '',
}: MonsterCombatSpriteProps) {
  const frameUrls = resolveMonsterIdleFrameUrls(idle?.frames)
  const fps = idle?.fps && idle.fps > 0 ? idle.fps : 6
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    setFrame(0)
  }, [frameUrls.join('|')])

  useEffect(() => {
    if (frameUrls.length <= 1 || dead) return
    const ms = Math.max(50, Math.round(1000 / fps))
    const id = window.setInterval(() => {
      setFrame((i) => (i + 1) % frameUrls.length)
    }, ms)
    return () => window.clearInterval(id)
  }, [frameUrls, fps, dead])

  const hasAnimation = frameUrls.length > 0
  const animatedSrc = hasAnimation ? frameUrls[frame % frameUrls.length] : null
  const staticSrc = resolveMonsterSpriteUrl(sprite)
  const src = animatedSrc ?? staticSrc
  const displayWidth =
    typeof width === 'number' && width > 0 ? Math.round(width) : DEFAULT_DISPLAY_SIZE
  const displayHeight =
    typeof height === 'number' && height > 0 ? Math.round(height) : DEFAULT_DISPLAY_SIZE

  /** Inline size on the art node — must beat `.tower__sprite { 56px }` without !important hacks. */
  const artStyle: CSSProperties = {
    width: displayWidth,
    height: displayHeight,
    maxWidth: 'none',
    maxHeight: 'none',
  }

  const artClass = [
    'tower__sprite',
    'combat-dock__mob-art',
    src ? 'tower__sprite--img' : 'tower__sprite--enemy',
    hasAnimation ? 'tower__sprite--animated' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span className="combat-dock__mob-slot">
      {src ? (
        <img
          className={artClass}
          src={src}
          alt=""
          width={displayWidth}
          height={displayHeight}
          style={artStyle}
          draggable={false}
        />
      ) : (
        <div className={artClass} style={artStyle} aria-hidden />
      )}
    </span>
  )
}
