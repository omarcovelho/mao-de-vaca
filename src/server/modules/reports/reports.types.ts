export type RegimeApi = 'competence' | 'cash';

export type ReportPeriodQuery = {
  regime?: string;
  from?: string;
  to?: string;
};

export type MonthlyEvolutionQuery = {
  regime?: string;
  months?: string;
  endMonth?: string;
};

export type SummaryResponse = {
  regime: RegimeApi;
  from: string;
  to: string;
  expenseTotal: number;
  incomeTotal: number;
  balance: number;
};

export type ByCategoryItem = {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  total: number;
  percent: number;
  children: ByCategoryItem[];
};

export type ByCategoryResponse = {
  regime: RegimeApi;
  from: string;
  to: string;
  items: ByCategoryItem[];
};

export type MonthlyEvolutionItem = {
  month: string;
  expenseTotal: number;
  incomeTotal: number;
};

export type MonthlyEvolutionResponse = {
  regime: RegimeApi;
  months: number;
  endMonth: string;
  items: MonthlyEvolutionItem[];
};
