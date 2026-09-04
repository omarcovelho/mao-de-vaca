import type {
  ListTransactionsParams,
  ListTransactionsResponse,
  TransactionItem,
  TransferCandidatesResponse,
  UpdateTransactionInput,
} from './types';

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

export async function listTransactions(
  params: ListTransactionsParams,
): Promise<ListTransactionsResponse> {
  const query = new URLSearchParams({
    regime: params.regime,
    from: params.from,
    to: params.to,
  });
  if (params.categoryId) {
    query.set('categoryId', params.categoryId);
  }
  if (params.accountId) {
    query.set('accountId', params.accountId);
  }
  if (params.includeInactive) {
    query.set('includeInactive', 'true');
  }

  const response = await apiFetch(`/api/transactions?${query.toString()}`);
  if (!response.ok) {
    throw new Error('Falha ao listar lançamentos');
  }
  return response.json() as Promise<ListTransactionsResponse>;
}

export async function updateTransaction(
  id: string,
  input: UpdateTransactionInput,
): Promise<TransactionItem> {
  const response = await apiFetch(`/api/transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message;
    throw new Error(message || 'Falha ao atualizar lançamento');
  }
  return response.json() as Promise<TransactionItem>;
}

export async function listTransferCandidates(params: {
  transactionId: string;
  amount?: string;
}): Promise<TransferCandidatesResponse> {
  const query = new URLSearchParams({
    transactionId: params.transactionId,
  });
  if (params.amount) {
    query.set('amount', params.amount);
  }
  const response = await apiFetch(
    `/api/transactions/transfer-candidates?${query.toString()}`,
  );
  if (!response.ok) {
    throw new Error('Falha ao buscar lançamentos para vínculo');
  }
  return response.json() as Promise<TransferCandidatesResponse>;
}
