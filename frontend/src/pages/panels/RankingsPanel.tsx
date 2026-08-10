import { useEffect, useState } from 'react'
import { fetchRankings, type RankingRow } from '../../api/rankings'

export function RankingsPanel() {
  const [by, setBy] = useState<'floor' | 'level' | 'wealth'>('floor')
  const [rows, setRows] = useState<RankingRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRankings(by)
      .then(setRows)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Erro'))
  }, [by])

  return (
    <section className="game-panel">
      <h1>Rankings</h1>
      <p className="hub__lead">Progresso público — sem paths internos.</p>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="create__actions">
        {(['floor', 'level', 'wealth'] as const).map((k) => (
          <button
            key={k}
            type="button"
            className={`btn ${by === k ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setBy(k)}
          >
            {k}
          </button>
        ))}
      </div>
      <table className="rankings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Jogador</th>
            <th>Nv</th>
            <th>Andar</th>
            <th>Kills</th>
            <th>Donos</th>
            <th>SkyCoin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.username}-${i}`}>
              <td>{i + 1}</td>
              <td>
                {r.characterName} <span className="hub__lead">@{r.username}</span>
              </td>
              <td>{r.level}</td>
              <td>
                {r.lastFloor}:{r.lastRoom}
              </td>
              <td>{r.kills}</td>
              <td>{r.floorsOwned}</td>
              <td>{r.skyCoin}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
