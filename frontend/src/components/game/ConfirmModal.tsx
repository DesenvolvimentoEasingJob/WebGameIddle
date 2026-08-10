import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export type ConfirmModalProps = {
  title: string
  body: string
  confirmLabel?: string
  cancelLabel?: string
  feeLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  title,
  body,
  confirmLabel = 'Continuar',
  cancelLabel = 'Cancelar',
  feeLabel,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return createPortal(
    <div className="modal" role="presentation" onClick={onCancel}>
      <div
        className="modal__card modal__card--confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <h2 id="confirm-modal-title" className="modal__title">
            {title}
          </h2>
          <button type="button" className="modal__close" onClick={onCancel} aria-label="Fechar">
            ×
          </button>
        </header>

        <p className="modal__text">{body}</p>

        {feeLabel ? <p className="modal__fee">{feeLabel}</p> : null}

        <div className="modal__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
