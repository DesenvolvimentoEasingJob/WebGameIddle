import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'

export function RegisterPage() {
  const { user, loading, register } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
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
      await register(username, email, password)
      navigate('/create/race', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha no cadastro')
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
        <h1>Criar conta</h1>
        <form className="auth-form" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="reg-user">Usuário</label>
            <input
              id="reg-user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              minLength={3}
              maxLength={32}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="reg-email">E-mail</label>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="reg-pass">Senha</label>
            <input
              id="reg-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="btn btn--primary btn--block" type="submit" disabled={submitting}>
            {submitting ? 'Criando…' : 'Criar conta'}
          </button>
        </form>
        <p className="auth-switch">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </div>
    </main>
  )
}
