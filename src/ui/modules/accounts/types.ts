export type SetupStatus = {
  hasAccounts: boolean;
  hasCards: boolean;
  hasCategories: boolean;
  readyForImport: boolean;
};

export type Bank = {
  id: string;
  name: string;
};

export type Origin = {
  id: string;
  label: string;
  bankId: string;
  bank: Bank;
  active: boolean;
};

export type CreateOriginInput = {
  label: string;
  bankId: string;
};
