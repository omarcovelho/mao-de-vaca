import type {
  CreateInvoiceInput,
  Invoice,
  InvoiceDetail,
  UpdateInvoiceInput,
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

export async function listInvoices(cardId: string): Promise<Invoice[]> {
  const response = await jsonFetch(`/api/cards/${cardId}/invoices`);
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Falha ao carregar faturas'));
  }
  return response.json() as Promise<Invoice[]>;
}

export async function getInvoice(invoiceId: string): Promise<InvoiceDetail> {
  const response = await jsonFetch(`/api/invoices/${invoiceId}`);
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Falha ao carregar a fatura'));
  }
  return response.json() as Promise<InvoiceDetail>;
}

export async function updateInvoice(
  invoiceId: string,
  input: UpdateInvoiceInput,
): Promise<InvoiceDetail> {
  const response = await jsonFetch(`/api/invoices/${invoiceId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(
      await readApiError(response, 'Não foi possível atualizar a fatura'),
    );
  }
  return response.json() as Promise<InvoiceDetail>;
}

export async function createInvoice(
  cardId: string,
  input: CreateInvoiceInput,
): Promise<Invoice> {
  const response = await jsonFetch(`/api/cards/${cardId}/invoices`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Não foi possível criar a fatura'));
  }
  return response.json() as Promise<Invoice>;
}

export async function linkPayments(
  invoiceId: string,
  transactionIds: string[],
): Promise<InvoiceDetail> {
  const response = await jsonFetch(`/api/invoices/${invoiceId}/payments`, {
    method: 'POST',
    body: JSON.stringify({ transactionIds }),
  });
  if (!response.ok) {
    throw new Error(
      await readApiError(response, 'Não foi possível vincular o pagamento'),
    );
  }
  return response.json() as Promise<InvoiceDetail>;
}

export async function unlinkPayment(
  invoiceId: string,
  transactionId: string,
): Promise<InvoiceDetail> {
  const response = await jsonFetch(
    `/api/invoices/${invoiceId}/payments/${transactionId}`,
    { method: 'DELETE' },
  );
  if (!response.ok) {
    throw new Error(
      await readApiError(response, 'Não foi possível desvincular o pagamento'),
    );
  }
  return response.json() as Promise<InvoiceDetail>;
}
