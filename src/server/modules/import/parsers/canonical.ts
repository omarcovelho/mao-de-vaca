export type CanonicalTransactionType = 'EXPENSE' | 'INCOME' | 'TRANSFER';

export type ParseMode = 'transactions' | 'invoice';

export type ParseOptions = {
  mode?: ParseMode;
};

export type CanonicalTransaction = {
  line: number;
  competenceDate: string;
  cashDate: string | null;
  description: string;
  amount: string;
  type: CanonicalTransactionType;
  category: string;
};

export type ParseRowError = {
  line: number;
  message: string;
};

export type ParseResult = {
  transactions: CanonicalTransaction[];
  errors: ParseRowError[];
};

export type ImportParser = {
  id: string;
  label: string;
  parse: (buffer: Buffer, options?: ParseOptions) => ParseResult;
};

export const MISSING_CATEGORY_LABEL = '(sem categoria)';
