import type { Bank, CreateOriginInput, Origin, SetupStatus } from './types';

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}

export async function getSetupStatus(): Promise<SetupStatus> {
  const response = await apiFetch('/api/setup/status');
  if (!response.ok) {
    throw new Error('Falha ao carregar status do setup');
  }
  return response.json() as Promise<SetupStatus>;
}

export async function listBanks(): Promise<Bank[]> {
  const response = await apiFetch('/api/banks');
  if (!response.ok) {
    throw new Error('Falha ao listar bancos');
  }
  return response.json() as Promise<Bank[]>;
}

export async function createBank(name: string): Promise<Bank> {
  const response = await apiFetch('/api/banks', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  if (response.status === 409) {
    throw new Error('Banco já cadastrado');
  }
  if (!response.ok) {
    throw new Error('Falha ao criar banco');
  }
  return response.json() as Promise<Bank>;
}

export async function listAccounts(
  includeInactive = false,
): Promise<Origin[]> {
  const query = includeInactive ? '?includeInactive=true' : '';
  const response = await apiFetch(`/api/accounts${query}`);
  if (!response.ok) {
    throw new Error('Falha ao listar contas');
  }
  return response.json() as Promise<Origin[]>;
}

export async function createAccount(input: CreateOriginInput): Promise<Origin> {
  const response = await apiFetch('/api/accounts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error('Falha ao criar conta');
  }
  return response.json() as Promise<Origin>;
}

export async function deactivateAccount(id: string): Promise<Origin> {
  const response = await apiFetch(`/api/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ active: false }),
  });
  if (!response.ok) {
    throw new Error('Falha ao desativar conta');
  }
  return response.json() as Promise<Origin>;
}

export async function listCards(includeInactive = false): Promise<Origin[]> {
  const query = includeInactive ? '?includeInactive=true' : '';
  const response = await apiFetch(`/api/cards${query}`);
  if (!response.ok) {
    throw new Error('Falha ao listar cartões');
  }
  return response.json() as Promise<Origin[]>;
}

export async function createCard(input: CreateOriginInput): Promise<Origin> {
  const response = await apiFetch('/api/cards', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error('Falha ao criar cartão');
  }
  return response.json() as Promise<Origin>;
}

export async function deactivateCard(id: string): Promise<Origin> {
  const response = await apiFetch(`/api/cards/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ active: false }),
  });
  if (!response.ok) {
    throw new Error('Falha ao desativar cartão');
  }
  return response.json() as Promise<Origin>;
}
