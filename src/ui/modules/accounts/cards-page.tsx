import { FormEvent, useEffect, useState } from 'react';
import { PageHeader } from '../../components/page-header';
import * as accountsApi from './api';
import { BankFields } from './bank-fields';
import { OnboardingContinue } from './onboarding-continue';
import { OnboardingFinalizeButton } from './onboarding-finalize-button';
import { OnboardingOriginsList } from './onboarding-origins-list';
import { OnboardingSetupHeader } from './onboarding-setup-header';
import { useSetupStatus } from './setup-status-context';
import type { Origin } from './types';

export function CardsPage() {
  const { reload, isOnboardingComplete, startOnboarding } = useSetupStatus();
  const isOnboarding = !isOnboardingComplete;
  const [items, setItems] = useState<Origin[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [bankId, setBankId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(isOnboarding);
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [originsRefreshKey, setOriginsRefreshKey] = useState(0);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const cards = await accountsApi.listCards();
      setItems(cards);
      setSelectedCardId((current) => {
        if (current && cards.some((card) => card.id === current)) {
          return current;
        }
        return cards[0]?.id ?? null;
      });
    } catch {
      setError('Não foi possível carregar os cartões.');
    } finally {
      setLoading(false);
    }
  }

  function refreshOriginsList() {
    setOriginsRefreshKey((current) => current + 1);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (isOnboarding) {
      startOnboarding();
    }
  }, [isOnboarding, startOnboarding]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!bankId) {
      setError('Selecione um banco.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await accountsApi.createCard({ label, bankId });
      setLabel('');
      setSelectedCardId(created.id);
      await load();
      await reload();
      refreshOriginsList();
      if (isOnboarding) {
        setStep('success');
        setShowForm(false);
      } else {
        setShowForm(false);
      }
    } catch {
      setError('Não foi possível criar o cartão.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(id: string) {
    setError(null);
    try {
      await accountsApi.deactivateCard(id);
      await load();
    } catch {
      setError('Não foi possível desativar o cartão.');
    }
  }

  function handleAddAnother() {
    setStep('form');
    setShowForm(true);
    setError(null);
  }

  const selectedCard =
    items.find((item) => item.id === selectedCardId) ?? items[0] ?? null;

  if (isOnboarding) {
    return (
      <section className="page onboarding">
        <OnboardingSetupHeader />
        {step === 'success' ? (
          <OnboardingContinue
            message="Cartão cadastrado com sucesso!"
            refreshKey={originsRefreshKey}
            anotherAction={{
              label: 'Adicionar outro cartão',
              onClick: handleAddAnother,
            }}
            otherOrigin={{ label: 'Adicionar conta', to: '/contas' }}
          />
        ) : (
          <>
            {(showForm || step === 'form') && (
              <form onSubmit={handleSubmit} className="form-panel">
                <h2 className="form-panel__title">Novo cartão</h2>
                <div className="form-stack">
                  <label>
                    Apelido
                    <input
                      name="label"
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                      required
                    />
                  </label>
                  <BankFields
                    bankId={bankId}
                    onBankIdChange={setBankId}
                    onError={setError}
                  />
                  {error ? <p role="alert">{error}</p> : null}
                  <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={submitting || !bankId}
                  >
                    {submitting ? 'Salvando…' : 'Adicionar cartão'}
                  </button>
                </div>
              </form>
            )}
            <OnboardingOriginsList refreshKey={originsRefreshKey} />
            <OnboardingFinalizeButton />
          </>
        )}
      </section>
    );
  }

  return (
    <section className="page">
      <PageHeader
        title="Cartões"
        subtitle="Faturas e saldo em aberto por cartão"
        trailing={
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setShowForm((open) => !open)}
          >
            {showForm ? 'Cancelar' : 'Adicionar cartão'}
          </button>
        }
      />

      {showForm ? (
        <form onSubmit={handleSubmit} className="form-panel">
          <h2 className="form-panel__title">Novo cartão</h2>
          <div className="form-stack">
            <label>
              Apelido
              <input
                name="label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                required
              />
            </label>
            <BankFields
              bankId={bankId}
              onBankIdChange={setBankId}
              onError={setError}
            />
            {error ? <p role="alert">{error}</p> : null}
            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting || !bankId}
            >
              {submitting ? 'Salvando…' : 'Adicionar cartão'}
            </button>
          </div>
        </form>
      ) : null}

      {!showForm && error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="page__empty">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="page__empty">Nenhum cartão cadastrado ainda.</p>
      ) : (
        <>
          <div className="pill-group" style={{ marginBottom: '1.5rem' }}>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`pill${selectedCard?.id === item.id ? ' pill--active' : ''}`}
                onClick={() => setSelectedCardId(item.id)}
                aria-pressed={selectedCard?.id === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>

          {selectedCard ? (
            <>
              <div className="hero-metric">
                <p className="hero-metric__value">—</p>
                <p className="hero-metric__label">
                  Saldo em aberto · {selectedCard.label}
                </p>
              </div>

              <section className="section" aria-labelledby="invoices-heading">
                <div className="section__header">
                  <h2 id="invoices-heading" className="section__title">
                    Faturas · {selectedCard.label}
                  </h2>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => void handleDeactivate(selectedCard.id)}
                  >
                    Desativar cartão
                  </button>
                </div>
                <p className="page__empty">
                  Nenhuma fatura importada ainda. Importe uma fatura de cartão
                  para acompanhar saldo e lançamentos aqui.
                </p>
              </section>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
