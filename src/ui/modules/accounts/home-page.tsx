import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/page-header';
import {
  AccountOriginIcon,
  CardOriginIcon,
} from '../../components/origin-icon';
import { RegimeToggle } from '../../components/regime-toggle';
import { CategoriesSetupBanner } from '../categories/categories-setup-banner';
import * as reportsApi from '../reports/api';
import { CategoryBreakdown } from '../reports/category-breakdown';
import type { ByCategoryItem } from '../reports/types';
import * as transactionsApi from '../transactions/api';
import { formatMonthLabel, monthBounds, toMonthKey } from '../transactions/month';
import { useRegime } from '../transactions/regime-context';
import type { TransactionItem } from '../transactions/types';
import { OnboardingContinue } from './onboarding-continue';
import { OnboardingSetupHeader } from './onboarding-setup-header';
import { SetupPrompt } from './setup-prompt';
import { useSetupStatus } from './setup-status-context';

function formatAmount(amount: number, type: TransactionItem['type']): string {
  const signed =
    type === 'EXPENSE' ? -Math.abs(amount) : type === 'INCOME' ? Math.abs(amount) : amount;
  return signed.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function HomePage() {
  const { loading, hasOrigins, isOnboardingComplete, status } =
    useSetupStatus();
  const { regime, setRegime } = useRegime();
  const [recent, setRecent] = useState<TransactionItem[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [expenseTotal, setExpenseTotal] = useState<number | null>(null);
  const [categories, setCategories] = useState<ByCategoryItem[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const month = toMonthKey();

  useEffect(() => {
    if (!isOnboardingComplete || !hasOrigins) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setRecentLoading(true);
      setMetricsLoading(true);
      try {
        const bounds = monthBounds(month);
        const [txResponse, summary, byCategory] = await Promise.all([
          transactionsApi.listTransactions({
            regime,
            from: bounds.from,
            to: bounds.to,
          }),
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
        ]);
        if (!cancelled) {
          setRecent(txResponse.items.slice(0, 3));
          setExpenseTotal(summary.expenseTotal);
          setCategories(byCategory.items);
        }
      } catch {
        if (!cancelled) {
          setRecent([]);
          setExpenseTotal(null);
          setCategories([]);
        }
      } finally {
        if (!cancelled) {
          setRecentLoading(false);
          setMetricsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOnboardingComplete, hasOrigins, regime, month]);

  if (loading) {
    return (
      <section className="page">
        <p className="page__empty">Carregando…</p>
      </section>
    );
  }

  if (!isOnboardingComplete) {
    if (!hasOrigins) {
      return <SetupPrompt />;
    }

    return (
      <section className="page onboarding">
        <OnboardingSetupHeader />
        <OnboardingContinue message="Adicione mais contas ou cartões, ou finalize quando estiver pronto." />
      </section>
    );
  }

  const regimeLabel =
    regime === 'competence'
      ? 'Gastos no mês · competência'
      : 'Saídas no mês · caixa';

  const showCategoriesBanner = status?.hasCategories === false;

  return (
    <section className="page">
      {showCategoriesBanner ? <CategoriesSetupBanner /> : null}
      <PageHeader
        title={formatMonthLabel(month)}
        subtitle="Resumo do mês"
        trailing={<RegimeToggle value={regime} onChange={setRegime} />}
      />

      <div className="hero-metric">
        <p className="hero-metric__value">
          {metricsLoading
            ? '…'
            : expenseTotal === null
              ? '—'
              : formatMoney(expenseTotal)}
        </p>
        <p className="hero-metric__label">{regimeLabel}</p>
      </div>

      <section className="section" aria-labelledby="categories-heading">
        <div className="section__header">
          <h2 id="categories-heading" className="section__title">
            Por categoria
          </h2>
          <Link to="/relatorios" className="btn btn--ghost">
            Ver relatórios
          </Link>
        </div>
        {metricsLoading ? (
          <p className="page__empty">Carregando…</p>
        ) : (
          <CategoryBreakdown items={categories} limit={3} />
        )}
      </section>

      <section className="section" aria-labelledby="recent-heading">
        <div className="section__header">
          <h2 id="recent-heading" className="section__title">
            Recentes
          </h2>
          <Link to="/lancamentos" className="btn btn--ghost">
            Ver todos
          </Link>
        </div>
        {recentLoading ? (
          <p className="page__empty">Carregando…</p>
        ) : recent.length === 0 ? (
          <p className="page__empty">Nenhum lançamento importado ainda.</p>
        ) : (
          <ul className="tx-rows">
            {recent.map((item) => (
              <li key={item.id} className="tx-row">
                <span className="tx-row__description" title={item.description}>
                  {item.description}
                </span>
                <span className="tx-row__category">{item.category.name}</span>
                {item.card ? (
                  <span className="tx-row__account">
                    <CardOriginIcon className="tx-row__origin-icon" />
                    <span className="tx-row__account-label">{item.card.label}</span>
                    <span className="bank-pill">{item.card.bank.name}</span>
                  </span>
                ) : item.account ? (
                  <span className="tx-row__account">
                    <AccountOriginIcon className="tx-row__origin-icon" />
                    <span className="tx-row__account-label">{item.account.label}</span>
                    <span className="bank-pill">{item.account.bank.name}</span>
                  </span>
                ) : null}
                <span
                  className={`tx-row__amount${
                    item.type === 'EXPENSE' ? ' tx-row__amount--expense' : ''
                  }`}
                >
                  {formatAmount(item.amount, item.type)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
