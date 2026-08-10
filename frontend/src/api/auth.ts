import type { AuthResponse, MeResponse } from '../types/api'
import { apiGet, apiPost } from './client'
import { clearToken, getToken, setToken } from './token'

export { clearToken, getToken, setToken }

export function register(username: string, email: string, password: string) {
  return apiPost<AuthResponse>('/api/auth/register', { username, email, password })
}

export function login(usernameOrEmail: string, password: string) {
  return apiPost<AuthResponse>('/api/auth/login', { usernameOrEmail, password })
}

export function fetchMe() {
  return apiGet<MeResponse>('/api/auth/me', true)
}
