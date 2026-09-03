export type InvoiceStatusApi = 'open' | 'partial' | 'paid';

export type CreateInvoiceDto = {
  referenceMonth?: string;
  dueDate?: string;
};

export type InvoiceResponse = {
  id: string;
  cardId: string;
  referenceMonth: string;
  dueDate: string;
  balance: number;
  status: InvoiceStatusApi;
  createdAt: string;
};

export type InvoiceTransactionItem = {
  id: string;
  description: string;
  amount: number;
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  competenceDate: string;
  cashDate: string | null;
  active: boolean;
  category: {
    id: string;
    name: string;
    color: string;
    icon: string;
    kind: 'EXPENSE' | 'INCOME' | 'NON_EXPENSE';
  };
};

export type InvoiceDetailResponse = InvoiceResponse & {
  card: {
    id: string;
    label: string;
    bank: { id: string; name: string };
  };
  transactions: InvoiceTransactionItem[];
};
