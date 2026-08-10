import { useEffect, useState } from 'react'
import { getApiBase } from '../api/editorApi'

export type ReviewCandidate = {
  index: number
  previewPath: string
}

type PickProps = {
  mode: 'pick'
  title: string
  candidates: ReviewCandidate[]
  onConfirm: (index: number) => void
  onCancel: () => void
}

type ApproveProps = {
  mode: 'approve'
  title: string
  frames: string[]
  fps?: number
  onConfirm: () => void
  onCancel: () => void
}

type PixelLabReviewModalProps = PickProps | ApproveProps

function resolvePreview(path: string, apiBase: string): string {
  const p = path.trim()
  if (!p) return ''
  if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:')) return p
  if (p.startsWith('/api/')) return `${apiBase.replace(/\/$/, '')}${p}`
  return p
}

export function PixelLabReviewModal(props: PixelLabReviewModalProps) {
  const apiBase = getApiBase()
  const [selected, setSelected] = useState(0)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [idleFrame, setIdleFrame] = useState(0)

  const frameSrcs =
    props.mode === 'approve'
      ? props.frames.map((f) => resolvePreview(f, apiBase)).filter(Boolean)
      : []

  const fps = props.mode === 'approve' && props.fps && props.fps > 0 ? props.fps : 6

  useEffect(() => {
    if (props.mode !== 'approve' || frameSrcs.length < 2) return
    const ms = Math.max(50, Math.round(1000 / fps))
    const id = window.setInterval(() => {
      setIdleFrame((i) => (i + 1) % frameSrcs.length)
    }, ms)
    return () => window.clearInterval(id)
  }, [props.mode, frameSrcs.length, fps])

  function openLightbox(src: string) {
    setLightbox(src)
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={props.onCancel}>
      <div
        className="modal modal--review"
        role="dialog"
        aria-labelledby="pixellab-review-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="pixellab-review-title">{props.title}</h2>
        <p className="muted small">
          {props.mode === 'pick'
            ? 'Escolha uma variante. Clique de novo (ou Ampliar) para ver em detalhe.'
            : 'Revise o grupo de frames. Aprovar grava a animação inteira; Descartar mantém o idle atual.'}
        </p>

        {props.mode === 'pick' ? (
          <div className="review-grid">
            {props.candidates.map((c) => {
              const src = resolvePreview(c.previewPath, apiBase)
              const active = selected === c.index
              return (
                <button
                  key={c.index}
                  type="button"
                  className={active ? 'review-tile is-selected' : 'review-tile'}
                  onClick={() => {
                    if (active) openLightbox(src)
                    else setSelected(c.index)
                  }}
                >
                  <img src={src} alt={`Variante ${c.index + 1}`} width={96} height={96} />
                  <span className="muted small">#{c.index + 1}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="review-idle">
            <div className="review-idle__preview">
              {frameSrcs[idleFrame] ? (
                <img
                  src={frameSrcs[idleFrame]}
                  alt=""
                  width={128}
                  height={128}
                  style={{ imageRendering: 'pixelated' }}
                  onClick={() => openLightbox(frameSrcs[idleFrame])}
                />
              ) : (
                <span className="muted small">sem frames</span>
              )}
            </div>
            <div className="review-idle__strip">
              {frameSrcs.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  className={i === idleFrame ? 'review-tile is-selected' : 'review-tile'}
                  onClick={() => openLightbox(src)}
                >
                  <img src={src} alt={`Frame ${i + 1}`} width={48} height={48} />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="modal__actions">
          <button type="button" className="btn" onClick={props.onCancel}>
            {props.mode === 'pick' ? 'Cancelar' : 'Descartar'}
          </button>
          {props.mode === 'pick' && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                const c = props.candidates.find((x) => x.index === selected)
                if (c) openLightbox(resolvePreview(c.previewPath, apiBase))
              }}
            >
              Ampliar
            </button>
          )}
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              if (props.mode === 'pick') props.onConfirm(selected)
              else props.onConfirm()
            }}
          >
            {props.mode === 'pick' ? 'Usar esta' : 'Aprovar animação'}
          </button>
        </div>
      </div>

      {lightbox && (
        <div
          className="lightbox-backdrop"
          role="presentation"
          onClick={(e) => {
            e.stopPropagation()
            setLightbox(null)
          }}
        >
          <img src={lightbox} alt="" className="lightbox-img" style={{ imageRendering: 'pixelated' }} />
        </div>
      )}
    </div>
  )
}
