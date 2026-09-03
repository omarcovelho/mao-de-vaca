export type InvoiceStatus = 'open' | 'partial' | 'paid';

export type Invoice = {
  id: string;
  cardId: string;
  referenceMonth: string;
  dueDate: string;
  balance: number;
  status: InvoiceStatus;
  createdAt: string;
};

export type CreateInvoiceInput = {
  referenceMonth: string;
  dueDate: string;
};

export type InvoiceTransaction = {
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

export type InvoiceDetail = Invoice & {
  card: {
    id: string;
    label: string;
    bank: { id: string; name: string };
  };
  transactions: InvoiceTransaction[];
};
