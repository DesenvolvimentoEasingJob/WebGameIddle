const STORAGE_KEY = 'skyspire_remembered_login'

export type RememberedLogin = {
  usernameOrEmail: string
  password: string
}

export function loadRememberedLogin(): RememberedLogin | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RememberedLogin>
    if (typeof parsed.usernameOrEmail !== 'string') return null
    return {
      usernameOrEmail: parsed.usernameOrEmail,
      password: typeof parsed.password === 'string' ? parsed.password : '',
    }
  } catch {
    return null
  }
}

export function saveRememberedLogin(data: RememberedLogin): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function clearRememberedLogin(): void {
  localStorage.removeItem(STORAGE_KEY)
}
