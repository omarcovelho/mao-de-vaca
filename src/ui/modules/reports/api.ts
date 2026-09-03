import type {
  ByCategoryResponse,
  MonthlyEvolutionParams,
  MonthlyEvolutionResponse,
  PeriodParams,
  SummaryResponse,
} from './types';

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}

export async function fetchSummary(
  params: PeriodParams,
): Promise<SummaryResponse> {
  const query = new URLSearchParams({
    regime: params.regime,
    from: params.from,
    to: params.to,
  });
  const response = await apiFetch(`/api/reports/summary?${query.toString()}`);
  if (!response.ok) {
    throw new Error('Falha ao carregar indicadores');
  }
  return response.json() as Promise<SummaryResponse>;
}

export async function fetchByCategory(
  params: PeriodParams,
): Promise<ByCategoryResponse> {
  const query = new URLSearchParams({
    regime: params.regime,
    from: params.from,
    to: params.to,
  });
  const response = await apiFetch(
    `/api/reports/by-category?${query.toString()}`,
  );
  if (!response.ok) {
    throw new Error('Falha ao carregar quebra por categoria');
  }
  return response.json() as Promise<ByCategoryResponse>;
}

export async function fetchMonthlyEvolution(
  params: MonthlyEvolutionParams,
): Promise<MonthlyEvolutionResponse> {
  const query = new URLSearchParams({
    regime: params.regime,
  });
  if (params.months !== undefined) {
    query.set('months', String(params.months));
  }
  if (params.endMonth) {
    query.set('endMonth', params.endMonth);
  }
  const response = await apiFetch(
    `/api/reports/monthly-evolution?${query.toString()}`,
  );
  if (!response.ok) {
    throw new Error('Falha ao carregar evolução mensal');
  }
  return response.json() as Promise<MonthlyEvolutionResponse>;
}
