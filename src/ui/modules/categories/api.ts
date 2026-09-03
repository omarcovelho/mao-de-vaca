import type { Category, CreateCategoryInput, UpdateCategoryInput } from './types';

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

export async function listCategories(
  includeInactive = false,
): Promise<Category[]> {
  const query = includeInactive ? '?includeInactive=true' : '';
  const response = await apiFetch(`/api/categories${query}`);
  if (!response.ok) {
    throw new Error('Falha ao listar categorias');
  }
  return response.json() as Promise<Category[]>;
}

export async function createCategory(
  input: CreateCategoryInput,
): Promise<Category> {
  const response = await apiFetch('/api/categories', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (response.status === 409) {
    throw new Error('Já existe uma categoria com este nome');
  }
  if (!response.ok) {
    throw new Error('Falha ao criar categoria');
  }
  return response.json() as Promise<Category>;
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
): Promise<Category> {
  const response = await apiFetch(`/api/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (response.status === 409) {
    throw new Error('Já existe uma categoria com este nome');
  }
  if (!response.ok) {
    throw new Error('Falha ao atualizar categoria');
  }
  return response.json() as Promise<Category>;
}

export async function deactivateCategory(id: string): Promise<Category> {
  return updateCategory(id, { active: false });
}
