import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) {
    return <Navigate to={user.hasCharacter ? '/hub' : '/create/race'} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const me = await login(usernameOrEmail, password)
      navigate(me.hasCharacter ? '/hub' : '/create/race', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha no login')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-panel">
        <Link to="/" className="auth-panel__brand">
          SkySpire End
        </Link>
        <h1>Entrar</h1>
        <form className="auth-form" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="login-user">Usuário ou e-mail</label>
            <input
              id="login-user"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="login-pass">Senha</label>
            <input
              id="login-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="btn btn--primary btn--block" type="submit" disabled={submitting}>
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="auth-switch">
          Não tem conta? <Link to="/register">Criar conta</Link>
        </p>
      </div>
    </main>
  )
}
