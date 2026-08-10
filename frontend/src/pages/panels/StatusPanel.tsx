import { Navigate } from 'react-router-dom'
import { useGameSession } from '../../game/GameSessionContext'
import { formatStat, sortStats, statLabel } from '../../game/stats'

export function StatusPanel() {
  const { state, skyCoin, character, stats, characterMissing } = useGameSession()

  if (characterMissing) {
    return <Navigate to="/create/race" replace />
  }

  return (
    <section className="game-panel">
      <h1>Status</h1>
      <p className="hub__lead">Dados completos do personagem.</p>
      {!character ? (
        <p>Carregando…</p>
      ) : (
        <>
          <div className="hub__meta status-panel__identity">
            <div>
              <strong>{character.name}</strong> · Nv. {state?.level ?? character.level}
            </div>
            <div>
              Raça: {character.raceId} · Classe: {character.classId}
            </div>
            <div>
              XP: {(state?.xp ?? character.xp).toLocaleString('pt-BR')} /{' '}
              {(state?.xpToNextLevel ?? character.xpToNextLevel).toLocaleString('pt-BR')} · SkyCoin:{' '}
              {(skyCoin ?? character.skyCoin).toLocaleString('pt-BR')}
            </div>
          </div>

          <h2 className="game-panel__subtitle">Atributos calculados</h2>
          {!stats || Object.keys(stats).length === 0 ? (
            <p className="hub__lead">Nenhum atributo retornado.</p>
          ) : (
            <div className="status-panel__stats">
              {sortStats(stats).map(([key, value]) => (
                <div key={key} className="status-panel__stat">
                  <span className="status-panel__stat-label">{statLabel(key)}</span>
                  <strong>{formatStat(value)}</strong>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}