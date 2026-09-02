export type SetupStatus = {
  hasAccounts: boolean;
  hasCards: boolean;
  hasCategories: boolean;
  readyForImport: boolean;
};

export type BankResponse = {
  id: string;
  name: string;
};

export type CreateBankDto = {
  name: string;
};

export type CreateOriginDto = {
  label: string;
  bankId: string;
};

export type UpdateOriginDto = {
  label?: string;
  bankId?: string;
  active?: boolean;
};

export type OriginResponse = {
  id: string;
  label: string;
  bankId: string;
  bank: BankResponse;
  active: boolean;
};
