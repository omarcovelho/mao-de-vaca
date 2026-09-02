import { useEffect, useState } from 'react';
import * as accountsApi from './api';
import type { Origin } from './types';

type OnboardingOriginsListProps = {
  refreshKey?: number;
};

export function OnboardingOriginsList({ refreshKey = 0 }: OnboardingOriginsListProps) {
  const [accounts, setAccounts] = useState<Origin[]>([]);
  const [cards, setCards] = useState<Origin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [nextAccounts, nextCards] = await Promise.all([
          accountsApi.listAccounts(),
          accountsApi.listCards(),
        ]);
        setAccounts(nextAccounts);
        setCards(nextCards);
      } catch {
        setError('Não foi possível carregar contas e cartões.');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [refreshKey]);

  if (loading) {
    return <p className="page__empty">Carregando cadastros…</p>;
  }

  if (error) {
    return (
      <p className="alert" role="alert">
        {error}
      </p>
    );
  }

  if (accounts.length === 0 && cards.length === 0) {
    return null;
  }

  return (
    <section
      className="onboarding-origins"
      aria-labelledby="onboarding-origins-heading"
    >
      <h3 id="onboarding-origins-heading" className="onboarding-origins__title">
        Cadastrados
      </h3>
      <ul className="list-rows">
        {accounts.map((item) => (
          <li key={`account-${item.id}`} className="list-row">
            <div className="list-row__main">
              <span className="list-row__title">{item.label}</span>
              <span className="origin-kind-pill">Conta</span>
              <span className="bank-pill">{item.bank.name}</span>
            </div>
          </li>
        ))}
        {cards.map((item) => (
          <li key={`card-${item.id}`} className="list-row">
            <div className="list-row__main">
              <span className="list-row__title">{item.label}</span>
              <span className="origin-kind-pill">Cartão</span>
              <span className="bank-pill">{item.bank.name}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
