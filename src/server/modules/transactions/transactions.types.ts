export type RegimeApi = 'competence' | 'cash';

export type ListTransactionsQuery = {
  regime?: string;
  from?: string;
  to?: string;
  categoryId?: string;
  accountId?: string;
  includeInactive?: string;
};

export type UpdateTransactionDto = {
  categoryId?: string;
  active?: boolean;
};

export type TransactionItemResponse = {
  id: string;
  description: string;
  amount: number;
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  competenceDate: string;
  cashDate: string | null;
  displayDate: string;
  active: boolean;
  category: {
    id: string;
    name: string;
    color: string;
    icon: string;
    kind: 'EXPENSE' | 'INCOME' | 'NON_EXPENSE';
  };
  account: {
    id: string;
    label: string;
    bank: { id: string; name: string };
  } | null;
  card: {
    id: string;
    label: string;
    bank: { id: string; name: string };
  } | null;
  invoiceId: string | null;
};

export type ListTransactionsResponse = {
  regime: RegimeApi;
  from: string;
  to: string;
  items: TransactionItemResponse[];
};
