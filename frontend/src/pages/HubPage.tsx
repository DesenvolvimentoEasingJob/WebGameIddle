import { Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { fetchMyCharacter } from '../api/content'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import { GameSessionProvider } from '../game/GameSessionContext'
import { GameShell } from '../components/game/GameShell'

/** Gate: exige personagem; monta shell + sessão de combate persistente. */
export function HubPage() {
  const { user, refresh } = useAuth()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMyCharacter()
      .then(async () => {
        if (!user?.hasCharacter) await refresh()
        setReady(true)
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          setError('no-character')
          return
        }
        setError(err instanceof Error ? err.message : 'Erro')
      })
  }, [refresh, user?.hasCharacter])

  if (error === 'no-character') {
    return <Navigate to="/create/race" replace />
  }

  if (error) {
    return (
      <main className="app-shell">
        <p className="form-error">{error}</p>
      </main>
    )
  }

  if (!ready) {
    return (
      <main className="app-shell">
        <p className="hub__lead">Carregando personagem…</p>
      </main>
    )
  }

  return (
    <GameSessionProvider>
      <GameShell />
    </GameSessionProvider>
  )
}
