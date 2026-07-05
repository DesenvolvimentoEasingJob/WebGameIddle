import { readApiError, type ApiError, formatApiError } from "./errors";



export type { ApiError };

export { formatApiError };



export interface UserDto {

  id: string;

  email: string;

  username: string;

  createdAt: string;

}



export interface AuthResponse {

  token: string;

  expiresAt: string;

  user: UserDto;

}



export interface RegisterPayload {

  email: string;

  username: string;

  password: string;

  confirmPassword: string;

}



export interface LoginPayload {

  login: string;

  password: string;

}



const API_BASE = import.meta.env.VITE_API_URL ?? "/api";



export async function register(payload: RegisterPayload): Promise<AuthResponse> {

  const response = await fetch(`${API_BASE}/auth/register`, {

    method: "POST",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify(payload),

  });



  if (!response.ok) {

    throw await readApiError(response, "Falha ao criar conta.");

  }



  return (await response.json()) as AuthResponse;

}



export async function login(payload: LoginPayload): Promise<AuthResponse> {

  const response = await fetch(`${API_BASE}/auth/login`, {

    method: "POST",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify(payload),

  });



  if (!response.ok) {

    throw await readApiError(response, "Falha ao entrar.");

  }



  return (await response.json()) as AuthResponse;

}



export async function fetchMe(token: string): Promise<UserDto> {

  const response = await fetch(`${API_BASE}/auth/me`, {

    headers: { Authorization: `Bearer ${token}` },

  });



  if (!response.ok) {

    throw await readApiError(response, "Sessão inválida.");

  }



  return (await response.json()) as UserDto;

}

