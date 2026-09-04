export type InvoiceStatusApi = 'open' | 'partial' | 'paid';

export type CreateInvoiceDto = {
  referenceMonth?: string;
  dueDate?: string;
};

export type UpdateInvoiceDto = {
  dueDate?: string;
};

export type LinkInvoicePaymentsDto = {
  transactionIds?: string[];
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
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER' | 'INVOICE_PAYMENT';
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

export type InvoicePaymentItem = {
  id: string;
  description: string;
  amount: number;
  type: 'INVOICE_PAYMENT';
  competenceDate: string;
  cashDate: string | null;
  account: {
    id: string;
    label: string;
    bank: { id: string; name: string };
  };
};

export type InvoiceDetailResponse = InvoiceResponse & {
  card: {
    id: string;
    label: string;
    bank: { id: string; name: string };
  };
  transactions: InvoiceTransactionItem[];
  payments: InvoicePaymentItem[];
};
