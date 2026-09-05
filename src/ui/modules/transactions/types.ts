export type Regime = 'competence' | 'cash';

export type TransactionItem = {
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
  regime: Regime;
  from: string;
  to: string;
  items: TransactionItem[];
};

export type ListTransactionsParams = {
  regime: Regime;
  from: string;
  to: string;
  categoryIds?: string[];
  accountId?: string;
  cardId?: string;
  q?: string;
  includeInactive?: boolean;
};

export type UpdateTransactionInput = {
  categoryId?: string;
  counterpartTransactionId?: string;
  active?: boolean;
};

export type TransferCandidatesResponse = {
  items: TransactionItem[];
};
