export type Regime = 'competence' | 'cash';

export type SummaryResponse = {
  regime: Regime;
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
  regime: Regime;
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
  regime: Regime;
  months: number;
  endMonth: string;
  items: MonthlyEvolutionItem[];
};

export type PeriodParams = {
  regime: Regime;
  from: string;
  to: string;
};

export type MonthlyEvolutionParams = {
  regime: Regime;
  months?: number;
  endMonth?: string;
};
