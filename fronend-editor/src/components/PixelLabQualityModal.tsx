import { useEffect, useState } from 'react'

export type PixelLabQuality = 'standard' | 'pro'
export type PixelLabKind = 'icon' | 'sprite' | 'idle'

export type PixelLabGenerateOptions = {
  quality: PixelLabQuality
  size: number
}

const QUALITY_KEY = 'skyspire.pixellab.quality'
const SIZE_STATIC_KEY = 'skyspire.pixellab.size.static'
const SIZE_IDLE_KEY = 'skyspire.pixellab.size.idle'

const STATIC_SIZES = [64, 128, 256] as const
const IDLE_SIZES = [64, 128] as const

export function loadPixelLabQuality(): PixelLabQuality {
  try {
    const raw = localStorage.getItem(QUALITY_KEY)
    if (raw === 'pro' || raw === 'standard') return raw
  } catch {
    /* ignore */
  }
  return 'standard'
}

export function savePixelLabQuality(quality: PixelLabQuality): void {
  try {
    localStorage.setItem(QUALITY_KEY, quality)
  } catch {
    /* ignore */
  }
}

function loadSize(kind: PixelLabKind): number {
  const key = kind === 'idle' ? SIZE_IDLE_KEY : SIZE_STATIC_KEY
  const fallback = kind === 'idle' ? 64 : 128
  try {
    const raw = Number(localStorage.getItem(key))
    if (kind === 'idle') {
      if (raw === 64 || raw === 128) return raw
    } else if (raw === 64 || raw === 128 || raw === 256) {
      return raw
    }
  } catch {
    /* ignore */
  }
  return fallback
}

function saveSize(kind: PixelLabKind, size: number): void {
  const key = kind === 'idle' ? SIZE_IDLE_KEY : SIZE_STATIC_KEY
  try {
    localStorage.setItem(key, String(size))
  } catch {
    /* ignore */
  }
}

export function sizesForKind(kind: PixelLabKind, quality: PixelLabQuality): number[] {
  if (kind === 'idle') {
    return quality === 'pro' ? [...IDLE_SIZES] : [64]
  }
  return [...STATIC_SIZES]
}

type PixelLabQualityModalProps = {
  title: string
  kind: PixelLabKind
  description?: string
  onCancel: () => void
  onConfirm: (options: PixelLabGenerateOptions) => void
}

export function PixelLabQualityModal({
  title,
  kind,
  description,
  onCancel,
  onConfirm,
}: PixelLabQualityModalProps) {
  const [quality, setQuality] = useState<PixelLabQuality>(() => loadPixelLabQuality())
  const [size, setSize] = useState(() => loadSize(kind))

  const allowedSizes = sizesForKind(kind, quality)

  useEffect(() => {
    if (!allowedSizes.includes(size)) {
      setSize(allowedSizes[0] ?? 64)
    }
  }, [allowedSizes, size])

  function selectQuality(next: PixelLabQuality) {
    setQuality(next)
    const allowed = sizesForKind(kind, next)
    if (!allowed.includes(size)) {
      setSize(allowed[0] ?? 64)
    }
  }

  function confirm() {
    const finalSize = allowedSizes.includes(size) ? size : (allowedSizes[0] ?? 64)
    savePixelLabQuality(quality)
    saveSize(kind, finalSize)
    onConfirm({ quality, size: finalSize })
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal modal--quality"
        role="dialog"
        aria-labelledby="pixellab-quality-title"
        aria-describedby="pixellab-quality-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="pixellab-quality-title">{title}</h2>
        <p id="pixellab-quality-desc" className="muted small">
          {description ??
            'Escolha modelo e resolução. Standard gasta bem menos; Pro custa ~10× e pode devolver várias variantes.'}
        </p>

        <div className="quality-options" role="radiogroup" aria-label="Qualidade PixelLab">
          <label className={quality === 'standard' ? 'quality-option is-selected' : 'quality-option'}>
            <input
              type="radio"
              name="pixellab-quality"
              value="standard"
              checked={quality === 'standard'}
              onChange={() => selectQuality('standard')}
            />
            <span className="quality-option__body">
              <span className="quality-option__title">Standard (barato)</span>
              <span className="quality-option__meta muted small">
                pixflux / animate-with-text — ideal para rascunhos
              </span>
            </span>
          </label>

          <label className={quality === 'pro' ? 'quality-option is-selected' : 'quality-option'}>
            <input
              type="radio"
              name="pixellab-quality"
              value="pro"
              checked={quality === 'pro'}
              onChange={() => selectQuality('pro')}
            />
            <span className="quality-option__body">
              <span className="quality-option__title">Pro (~10× créditos)</span>
              <span className="quality-option__meta muted small">
                generate-image-v2 / animate-with-text-v2 — várias variantes possíveis
              </span>
            </span>
          </label>
        </div>

        <p className="field__label" style={{ marginTop: '0.75rem' }}>
          Resolução
        </p>
        <div className="size-options" role="radiogroup" aria-label="Resolução">
          {sizesForKind(kind, 'pro').map((preset) => {
            const disabled = !allowedSizes.includes(preset)
            return (
              <label
                key={preset}
                className={
                  size === preset && !disabled
                    ? 'size-option is-selected'
                    : disabled
                      ? 'size-option is-disabled'
                      : 'size-option'
                }
              >
                <input
                  type="radio"
                  name="pixellab-size"
                  value={preset}
                  checked={size === preset}
                  disabled={disabled}
                  onChange={() => setSize(preset)}
                />
                <span>
                  {preset}×{preset}
                  {disabled ? ' (só Pro)' : ''}
                </span>
              </label>
            )
          })}
        </div>
        {kind === 'idle' && quality === 'standard' && (
          <p className="muted small">Standard idle só suporta 64×64 na API clássica.</p>
        )}
        {quality === 'pro' && (
          <p className="muted small">
            Pro: custo sobe com o tamanho e pode gerar um lote de imagens — você escolhe depois.
          </p>
        )}

        <div className="modal__actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="btn btn--primary" onClick={confirm}>
            Gerar
          </button>
        </div>
      </div>
    </div>
  )
}
