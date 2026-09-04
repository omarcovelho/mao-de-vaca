export const SYSTEM_CATEGORY_KEYS = {
  NON_EXPENSE_ROOT: 'NON_EXPENSE_ROOT',
  INVOICE_PAYMENT: 'INVOICE_PAYMENT',
  ACCOUNT_TRANSFER: 'ACCOUNT_TRANSFER',
  INVESTMENT: 'INVESTMENT',
} as const;

export type SystemCategoryKey =
  (typeof SYSTEM_CATEGORY_KEYS)[keyof typeof SYSTEM_CATEGORY_KEYS];

export const SYSTEM_NON_EXPENSE_TREE = {
  root: {
    systemKey: SYSTEM_CATEGORY_KEYS.NON_EXPENSE_ROOT,
    name: 'Não-despesa',
    kind: 'NON_EXPENSE' as const,
    color: '#718096',
    icon: 'arrows',
  },
  leaves: [
    {
      systemKey: SYSTEM_CATEGORY_KEYS.INVOICE_PAYMENT,
      name: 'Pagamento de fatura',
    },
    {
      systemKey: SYSTEM_CATEGORY_KEYS.ACCOUNT_TRANSFER,
      name: 'Transferências entre contas',
    },
    {
      systemKey: SYSTEM_CATEGORY_KEYS.INVESTMENT,
      name: 'Aplicações/resgates',
    },
  ],
} as const;
