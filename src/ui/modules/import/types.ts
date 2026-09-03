export type ImportModeId = 'transactions' | 'invoice';

export type ImportAccount = {
  id: string;
  label: string;
  bank: { id: string; name: string };
  active: boolean;
};

export type ImportOptions = {
  modes: Array<{ id: ImportModeId; label: string; enabled: boolean }>;
  parsers: Array<{ id: string; label: string }>;
  accounts: ImportAccount[];
};

export type PreviewRow = {
  line: number;
  competenceDate?: string;
  cashDate?: string;
  description?: string;
  amount?: string;
  type?: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  category?: string;
  categoryId?: string | null;
  error?: string;
};

export type PreviewResponse = {
  rows: PreviewRow[];
  unknownCategories: string[];
  summary: {
    rowCount: number;
    validCount: number;
    errorCount: number;
    unknownCategoryCount: number;
  };
};

export type ConfirmResponse = {
  id: string;
  importBatchId: string;
  created: number;
  skipped: number;
  errors: Array<{ line: number; message: string }>;
};

export type ImportHistoryItem = {
  id: string;
  importMode: ImportModeId;
  parserId: string;
  fileName: string;
  accountId: string | null;
  accountLabel: string | null;
  createdCount: number;
  skippedCount: number;
  errorCount: number;
  createdAt: string;
};

export type CategoryMappingValue =
  | string
  | { create: { name: string } };
