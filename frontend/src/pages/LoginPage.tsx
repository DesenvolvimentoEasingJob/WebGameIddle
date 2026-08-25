import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import {
  clearRememberedLogin,
  loadRememberedLogin,
  saveRememberedLogin,
} from '../auth/rememberedLogin'

function readInitialForm() {
  const remembered = loadRememberedLogin()
  return {
    usernameOrEmail: remembered?.usernameOrEmail ?? '',
    password: remembered?.password ?? '',
    remember: Boolean(remembered),
  }
}

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const [initial] = useState(readInitialForm)
  const [usernameOrEmail, setUsernameOrEmail] = useState(initial.usernameOrEmail)
  const [password, setPassword] = useState(initial.password)
  const [remember, setRemember] = useState(initial.remember)
  const [showPassword, setShowPassword] = useState(false)
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
      if (remember) {
        saveRememberedLogin({ usernameOrEmail, password })
      } else {
        clearRememberedLogin()
      }
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
            <div className="field-password">
              <input
                id="login-pass"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="field-password__toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={showPassword}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>
          <label className="field-check">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>Lembrar dados neste dispositivo</span>
          </label>
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
