import type {
  ConfirmResponse,
  ImportHistoryItem,
  ImportOptions,
  PreviewResponse,
} from './types';

async function jsonFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}

export async function getImportOptions(): Promise<ImportOptions> {
  const response = await jsonFetch('/api/imports/options');
  if (!response.ok) {
    throw new Error('Falha ao carregar opções de importação');
  }
  return response.json() as Promise<ImportOptions>;
}

export async function listImportHistory(): Promise<ImportHistoryItem[]> {
  const response = await jsonFetch('/api/imports');
  if (!response.ok) {
    throw new Error('Falha ao carregar histórico de importações');
  }
  return response.json() as Promise<ImportHistoryItem[]>;
}

export async function previewImport(form: FormData): Promise<PreviewResponse> {
  const response = await fetch('/api/imports/preview', {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Não foi possível pré-visualizar o arquivo'));
  }
  return response.json() as Promise<PreviewResponse>;
}

export async function confirmImport(form: FormData): Promise<ConfirmResponse> {
  const response = await fetch('/api/imports/confirm', {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Não foi possível confirmar a importação'));
  }
  return response.json() as Promise<ConfirmResponse>;
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      return body.message.join(' ');
    }
    if (body.message) {
      return body.message;
    }
  } catch {
    /* use fallback */
  }
  return fallback;
}
