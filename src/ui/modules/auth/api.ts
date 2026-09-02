import type { AuthUser, LoginCredentials } from './types';

type UnauthorizedHandler = () => void;

let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (response.status === 401) {
    onUnauthorized?.();
  }

  return response;
}

export async function login(credentials: LoginCredentials): Promise<AuthUser> {
  const response = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    throw new Error('Credenciais inválidas');
  }

  return response.json() as Promise<AuthUser>;
}

export async function logout(): Promise<void> {
  await apiFetch('/api/auth/logout', { method: 'POST' });
}

export async function me(): Promise<AuthUser | null> {
  const response = await apiFetch('/api/auth/me');
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error('Falha ao carregar sessão');
  }
  return response.json() as Promise<AuthUser>;
}
