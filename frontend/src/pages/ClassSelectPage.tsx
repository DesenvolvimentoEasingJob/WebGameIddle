import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { createCharacter, listClasses } from '../api/content'
import type { GameClass } from '../types/api'
import { useAuth } from '../auth/AuthContext'
import { useCreateFlow } from '../auth/CreateFlowContext'
import { ApiError } from '../api/client'

export function ClassSelectPage() {
  const { user, logout, refresh } = useAuth()
  const { raceId, classId, setClassId, reset } = useCreateFlow()
  const [classes, setClasses] = useState<GameClass[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    listClasses()
      .then(setClasses)
      .catch((e: Error) => setError(e.message))
  }, [])

  const filtered = useMemo(() => {
    if (!raceId) return []
    return classes.filter(
      (c) =>
        !c.allowedRaces?.length ||
        c.allowedRaces.includes('*') ||
        c.allowedRaces.includes(raceId),
    )
  }, [classes, raceId])

  if (user?.hasCharacter) {
    return <Navigate to="/hub" replace />
  }

  if (!raceId) {
    return <Navigate to="/create/race" replace />
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!raceId || !classId) return
    setError(null)
    setSubmitting(true)
    try {
      await createCharacter(name, raceId, classId)
      await refresh()
      reset()
      navigate('/hub', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao criar personagem')
    } finally {
      setSubmitting(false)
    }
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
      <h1>Escolha sua classe</h1>
      <p className="create__lead">Raça selecionada: {raceId}</p>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="choice-grid">
        {filtered.map((cls) => (
          <button
            key={cls.id}
            type="button"
            className={`choice-card${classId === cls.id ? ' choice-card--selected' : ''}`}
            onClick={() => setClassId(cls.id)}
          >
            <h2>{cls.name}</h2>
            <p>{cls.description}</p>
          </button>
        ))}
      </div>
      <form className="auth-form" onSubmit={onCreate} style={{ maxWidth: '24rem' }}>
        <div className="field">
          <label htmlFor="char-name">Nome do personagem</label>
          <input
            id="char-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            maxLength={24}
            required
          />
        </div>
        <div className="create__actions">
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/create/race')}>
            Voltar
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={!classId || submitting}
          >
            {submitting ? 'Criando…' : 'Criar personagem'}
          </button>
        </div>
      </form>
    </main>
  )
}
