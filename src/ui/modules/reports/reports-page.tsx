import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/page-header';
import { RegimeToggle } from '../../components/regime-toggle';
import {
  formatMonthLabel,
  monthBounds,
  shiftMonth,
  toMonthKey,
} from '../transactions/month';
import { useRegime } from '../transactions/regime-context';
import * as reportsApi from './api';
import { CategoryBreakdown } from './category-breakdown';
import { MonthlyEvolutionChart } from './monthly-evolution-chart';
import type {
  ByCategoryItem,
  MonthlyEvolutionItem,
  SummaryResponse,
} from './types';

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function leafLancamentosPath(month: string, categoryId: string): string {
  const query = new URLSearchParams({
    month,
    categoryId,
  });
  return `/lancamentos?${query.toString()}`;
}

export function ReportsPage() {
  const { regime, setRegime } = useRegime();
  const [month, setMonth] = useState(() => toMonthKey());
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [categories, setCategories] = useState<ByCategoryItem[]>([]);
  const [evolution, setEvolution] = useState<MonthlyEvolutionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const bounds = monthBounds(month);
        const [summaryRes, categoryRes, evolutionRes] = await Promise.all([
          reportsApi.fetchSummary({
            regime,
            from: bounds.from,
            to: bounds.to,
          }),
          reportsApi.fetchByCategory({
            regime,
            from: bounds.from,
            to: bounds.to,
          }),
          reportsApi.fetchMonthlyEvolution({
            regime,
            months: 6,
            endMonth: month,
          }),
        ]);
        if (!cancelled) {
          setSummary(summaryRes);
          setCategories(categoryRes.items);
          setEvolution(evolutionRes.items);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Falha ao carregar relatórios',
          );
          setSummary(null);
          setCategories([]);
          setEvolution([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [regime, month]);

  const topCategory = categories[0] ?? null;
  const variation =
    evolution.length >= 2
      ? (() => {
          const prev = evolution[evolution.length - 2].expenseTotal;
          const curr = evolution[evolution.length - 1].expenseTotal;
          if (prev === 0) {
            return curr === 0 ? 0 : 100;
          }
          return ((curr - prev) / prev) * 100;
        })()
      : null;

  return (
    <section className="page">
      <PageHeader
        title="Relatórios"
        subtitle={formatMonthLabel(month)}
        trailing={
          <div className="page-header__actions">
            <div className="month-nav" role="group" aria-label="Mês">
              <button
                type="button"
                className="btn btn--ghost btn--compact"
                onClick={() => setMonth((current) => shiftMonth(current, -1))}
                aria-label="Mês anterior"
              >
                ‹
              </button>
              <input
                type="month"
                className="month-nav__input"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                aria-label="Selecionar mês"
              />
              <button
                type="button"
                className="btn btn--ghost btn--compact"
                onClick={() => setMonth((current) => shiftMonth(current, 1))}
                aria-label="Próximo mês"
              >
                ›
              </button>
            </div>
            <RegimeToggle value={regime} onChange={setRegime} />
          </div>
        }
      />

      {loading ? <p className="page__empty">Carregando…</p> : null}
      {error ? <p className="page__error">{error}</p> : null}

      {!loading && !error && summary ? (
        <>
          <div className="report-stats" aria-label="Indicadores do período">
            <div className="report-stat">
              <p className="report-stat__label">Gastos do mês</p>
              <p className="report-stat__value">
                {formatMoney(summary.expenseTotal)}
              </p>
            </div>
            <div className="report-stat">
              <p className="report-stat__label">Maior categoria</p>
              <p className="report-stat__value">
                {topCategory ? topCategory.name : '—'}
              </p>
              {topCategory ? (
                <p className="report-stat__hint">
                  {formatMoney(topCategory.total)}
                </p>
              ) : null}
            </div>
            <div className="report-stat">
              <p className="report-stat__label">Variação vs mês anterior</p>
              <p className="report-stat__value">
                {variation === null
                  ? '—'
                  : `${variation >= 0 ? '+' : ''}${variation.toLocaleString(
                      'pt-BR',
                      {
                        maximumFractionDigits: 0,
                      },
                    )}%`}
              </p>
            </div>
          </div>

          <section className="section" aria-labelledby="income-balance-heading">
            <div className="section__header">
              <h2 id="income-balance-heading" className="section__title">
                Receitas e saldo
              </h2>
            </div>
            <div className="report-stats report-stats--secondary">
              <div className="report-stat">
                <p className="report-stat__label">Receitas</p>
                <p className="report-stat__value">
                  {formatMoney(summary.incomeTotal)}
                </p>
              </div>
              <div className="report-stat">
                <p className="report-stat__label">Saldo</p>
                <p className="report-stat__value">
                  {formatMoney(summary.balance)}
                </p>
              </div>
            </div>
          </section>

          <section className="section" aria-labelledby="evolution-heading">
            <div className="section__header">
              <h2 id="evolution-heading" className="section__title">
                Evolução mensal
              </h2>
              <p className="section__hint">Últimos 6 meses · gastos</p>
            </div>
            <MonthlyEvolutionChart items={evolution} />
          </section>

          <section
            className="section"
            aria-labelledby="reports-categories-heading"
          >
            <div className="section__header">
              <h2 id="reports-categories-heading" className="section__title">
                Por categoria
              </h2>
            </div>
            <CategoryBreakdown
              items={categories}
              leafTo={(item) => leafLancamentosPath(month, item.categoryId)}
            />
          </section>
        </>
      ) : null}
    </section>
  );
}
