import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { listRaces } from '../api/content'
import type { Race } from '../types/api'
import { useAuth } from '../auth/AuthContext'
import { useCreateFlow } from '../auth/CreateFlowContext'

export function RaceSelectPage() {
  const { user, logout } = useAuth()
  const { raceId, setRaceId, setClassId } = useCreateFlow()
  const [races, setRaces] = useState<Race[]>([])
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    listRaces()
      .then(setRaces)
      .catch((e: Error) => setError(e.message))
  }, [])

  if (user?.hasCharacter) {
    return <Navigate to="/hub" replace />
  }

  return (
    <main className="app-shell create">
      <div className="app-shell__top">
        <Link to="/" className="app-shell__brand">
          SkySpire End
        </Link>
        <button type="button" className="btn btn--ghost" onClick={logout}>
          Sair
        </button>
      </div>
      <h1>Escolha sua raça</h1>
      <p className="create__lead">Cada raça define atributos base e espaços de equipamento.</p>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="choice-grid">
        {races.map((race) => (
          <button
            key={race.id}
            type="button"
            className={`choice-card${raceId === race.id ? ' choice-card--selected' : ''}`}
            onClick={() => {
              setRaceId(race.id)
              setClassId(null)
            }}
          >
            <h2>{race.name}</h2>
            <p>{race.description}</p>
          </button>
        ))}
      </div>
      <div className="create__actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={!raceId}
          onClick={() => navigate('/create/class')}
        >
          Continuar
        </button>
      </div>
    </main>
  )
}
