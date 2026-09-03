export type ImportModeApi = 'transactions' | 'invoice';

export type CategoryMappingValue =
  | string
  | {
      create: { name: string };
    };

export type CategoryMappings = Record<string, CategoryMappingValue>;

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

export const DEFAULT_CREATED_CATEGORY_COLOR = '#2d6a4f';
export const DEFAULT_CREATED_CATEGORY_ICON = 'tag';
export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
