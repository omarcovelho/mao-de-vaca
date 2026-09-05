export type RegimeApi = 'competence' | 'cash';

export type ListTransactionsQuery = {
  regime?: string;
  from?: string;
  to?: string;
  /** Single id or repeated query params; each expands to subtree when parent. */
  categoryId?: string | string[];
  accountId?: string;
  cardId?: string;
  q?: string;
  includeInactive?: string;
};

export type TransferCandidatesQuery = {
  transactionId?: string;
  amount?: string;
};

export type UpdateTransactionDto = {
  categoryId?: string;
  counterpartTransactionId?: string;
  active?: boolean;
};

export type TransactionItemResponse = {
  id: string;
  description: string;
  amount: number;
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER' | 'INVOICE_PAYMENT';
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
    systemKey: string | null;
  } | null;
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
  transferCounterpartId: string | null;
};

export type ListTransactionsResponse = {
  regime: RegimeApi;
  from: string;
  to: string;
  items: TransactionItemResponse[];
};

export type TransferCandidatesResponse = {
  items: TransactionItemResponse[];
};
