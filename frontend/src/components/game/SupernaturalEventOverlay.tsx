import { createPortal } from 'react-dom'

/** Overlay bloqueante enquanto o servidor gera drop único (OpenAI / ícone). */
export function SupernaturalEventOverlay() {
  return createPortal(
    <div className="modal supernatural-event" role="alertdialog" aria-busy="true" aria-live="polite">
      <div className="modal__card supernatural-event__card">
        <div className="supernatural-event__orb" aria-hidden />
        <p className="supernatural-event__eyebrow">Evento sobrenatural</p>
        <h2 className="modal__title supernatural-event__title">Um evento sobrenatural está ocorrendo</h2>
        <p className="modal__text supernatural-event__text">
          A energia do universo está sendo reunida aqui nesta sala.
        </p>
        <p className="supernatural-event__wait">Aguarde…</p>
      </div>
    </div>,
    document.body,
  )
}
