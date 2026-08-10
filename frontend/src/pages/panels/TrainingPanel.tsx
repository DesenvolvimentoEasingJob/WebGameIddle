import { useCallback, useEffect, useId, useState } from 'react'
import { fetchTrainingCosts, trainAttribute, type TrainingCost } from '../../api/training'
import { ApiError } from '../../api/client'
import { resolveAttributeCardUrl } from '../../game/attributeAssets'
import { useGameSession } from '../../game/GameSessionContext'
import { formatStat, formatStatDelta, statLabel } from '../../game/stats'

function formatCoin(value: number) {
  return value.toLocaleString('pt-BR')
}

const DERIVED_KEYS = [
  'hpBase',
  'mpBase',
  'dmgBase',
  'capBase',
  'hpRegenPerSec',
  'attackSpeed',
  'magicianCastTime',
] as const

export function TrainingPanel() {
  const { refresh, refreshCharacter, character, skyCoin, stats } = useGameSession()
  const base = character?.baseStats ?? {}
  const [costs, setCosts] = useState<TrainingCost[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [infoAttr, setInfoAttr] = useState<string | null>(null)
  const infoTitleId = useId()

  const refreshCosts = useCallback(async () => {
    try {
      const res = await fetchTrainingCosts()
      setCosts(res.attributes)
    } catch {
      setCosts([])
    }
  }, [])

  useEffect(() => {
    void refreshCosts()
  }, [refreshCosts])

  async function onTrain(attribute: string, displayName: string) {
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      const res = await trainAttribute(attribute)
      setMsg(
        `${displayName} → ${formatStat(res.value)} (−${formatCoin(res.cost)} SkyCoin · treinos: ${res.amount})`,
      )
      await Promise.all([refresh(), refreshCharacter(), refreshCosts()])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha no treino')
    } finally {
      setBusy(false)
    }
  }

  const infoRow = infoAttr ? costs.find((c) => c.attribute === infoAttr) : null
  const infoTitle = infoRow
    ? infoRow.name?.trim() || statLabel(infoRow.attribute)
    : ''

  return (
    <section className="game-panel">
      <h1>Campo de treinamento</h1>
      <p className="hub__lead">
        Escolha um atributo para treinar. Detalhes e fórmulas ficam no ícone{' '}
        <span className="magic-card__info-hint" aria-hidden>
          i
        </span>
        . Saldo: {skyCoin != null ? `${formatCoin(skyCoin)} SkyCoin` : '—'}
      </p>
      {error ? <p className="form-error">{error}</p> : null}
      {msg ? <p className="hub__lead">{msg}</p> : null}

      {stats ? (
        <div className="train-derived">
          <h2 className="game-panel__subtitle">Efeitos calculados</h2>
          <div className="train-derived__grid">
            {DERIVED_KEYS.map((key) => {
              const value = stats[key]
              if (value == null) return null
              return (
                <div key={key} className="train-derived__item">
                  <span>{statLabel(key)}</span>
                  <strong>{formatStat(value)}</strong>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="train-card-grid">
        {costs.map((row) => {
          const cost = row.cost
          const amount = row.amount ?? 0
          const affordable = skyCoin == null || skyCoin >= cost
          const hasBase = base[row.attribute] != null || row.currentValue != null
          const title = row.name?.trim() || statLabel(row.attribute)
          const cardSrc = resolveAttributeCardUrl(row.cardPath)

          return (
            <article key={row.attribute} className="magic-card">
              <div className="magic-card__frame">
                <header className="magic-card__titlebar">
                  <h3 className="magic-card__name">{title}</h3>
                  <div className="magic-card__title-right">
                    <span className="magic-card__value">{formatStat(row.currentValue)}</span>
                    <button
                      type="button"
                      className="magic-card__info"
                      aria-label={`Detalhes de ${title}`}
                      title="Detalhes do atributo"
                      onClick={() => setInfoAttr(row.attribute)}
                    >
                      i
                    </button>
                  </div>
                </header>

                <div className="magic-card__art">
                  {cardSrc ? (
                    <img src={cardSrc} alt="" className="magic-card__img" />
                  ) : (
                    <div className="magic-card__art-fallback" aria-hidden>
                      {title.slice(0, 1)}
                    </div>
                  )}
                </div>

                {row.description ? (
                  <p className="magic-card__flavor">{row.description}</p>
                ) : null}

                <footer className="magic-card__footer">
                  <span
                    className={`magic-card__cost${affordable ? '' : ' magic-card__cost--short'}`}
                  >
                    {formatCoin(cost)} SkyCoin
                    {amount > 0 ? ` · ${formatStatDelta(amount)}` : ''}
                  </span>
                  <button
                    type="button"
                    className="btn btn--primary btn--block magic-card__train"
                    disabled={busy || !hasBase || !affordable}
                    title={affordable ? undefined : 'SkyCoin insuficiente'}
                    onClick={() => void onTrain(row.attribute, title)}
                  >
                    Treinar
                  </button>
                </footer>
              </div>
            </article>
          )
        })}
      </div>

      {infoRow ? (
        <div
          className="magic-card-modal"
          role="presentation"
          onClick={() => setInfoAttr(null)}
        >
          <div
            className="magic-card-modal__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={infoTitleId}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="magic-card-modal__head">
              <h2 id={infoTitleId}>{infoTitle}</h2>
              <button
                type="button"
                className="btn"
                onClick={() => setInfoAttr(null)}
              >
                Fechar
              </button>
            </header>
            <p className="magic-card-modal__key">
              {infoRow.attribute}
              {infoRow.amount > 0
                ? ` · ${formatStatDelta(infoRow.amount)} treino${infoRow.amount === 1 ? '' : 's'}`
                : ''}
              {stats?.[infoRow.attribute] != null
                ? ` · efetivo ${formatStat(stats[infoRow.attribute]!)}`
                : ''}
            </p>
            {infoRow.description ? (
              <p className="magic-card-modal__flavor">{infoRow.description}</p>
            ) : null}
            {(infoRow.formulas?.length ?? 0) > 0 ? (
              <>
                <h3 className="magic-card-modal__sub">Ao treinar, aumenta</h3>
                <ul className="magic-card-modal__rules">
                  {infoRow.formulas!.map((f) => (
                    <li key={f}>
                      <code>{f}</code>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="muted">Sem fórmulas neste atributo.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
