import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrentMonthLabel } from '../../components/format-month';
import { PageHeader } from '../../components/page-header';
import { RegimeToggle, type Regime } from '../../components/regime-toggle';
import { OnboardingContinue } from './onboarding-continue';
import { OnboardingSetupHeader } from './onboarding-setup-header';
import { SetupPrompt } from './setup-prompt';
import { useSetupStatus } from './setup-status-context';

export function HomePage() {
  const { loading, hasOrigins, isOnboardingComplete } = useSetupStatus();
  const [regime, setRegime] = useState<Regime>('competence');

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

  return (
    <section className="page">
      <PageHeader
        title={formatCurrentMonthLabel()}
        subtitle="Resumo do mês"
        trailing={<RegimeToggle value={regime} onChange={setRegime} />}
      />

      <div className="hero-metric">
        <p className="hero-metric__value">—</p>
        <p className="hero-metric__label">{regimeLabel}</p>
      </div>

      <section className="section" aria-labelledby="categories-heading">
        <div className="section__header">
          <h2 id="categories-heading" className="section__title">
            Por categoria
          </h2>
        </div>
        <p className="page__empty">
          Importe extratos para ver a distribuição por categoria.
        </p>
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
        <p className="page__empty">Nenhum lançamento importado ainda.</p>
      </section>
    </section>
  );
}
