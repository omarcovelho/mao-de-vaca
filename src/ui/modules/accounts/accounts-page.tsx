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

export function AccountsPage() {
  const { reload, isOnboardingComplete, startOnboarding } = useSetupStatus();
  const isOnboarding = !isOnboardingComplete;
  const [items, setItems] = useState<Origin[]>([]);
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
      setItems(await accountsApi.listAccounts());
    } catch {
      setError('Não foi possível carregar as contas.');
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
      await accountsApi.createAccount({ label, bankId });
      setLabel('');
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
      setError('Não foi possível criar a conta.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(id: string) {
    setError(null);
    try {
      await accountsApi.deactivateAccount(id);
      await load();
    } catch {
      setError('Não foi possível desativar a conta.');
    }
  }

  function handleAddAnother() {
    setStep('form');
    setShowForm(true);
    setError(null);
  }

  if (isOnboarding) {
    return (
      <section className="page onboarding">
        <OnboardingSetupHeader />
        {step === 'success' ? (
          <OnboardingContinue
            message="Conta cadastrada com sucesso!"
            refreshKey={originsRefreshKey}
            anotherAction={{
              label: 'Adicionar outra conta',
              onClick: handleAddAnother,
            }}
            otherOrigin={{ label: 'Adicionar cartão', to: '/cartoes' }}
          />
        ) : (
          <>
            {(showForm || step === 'form') && (
              <form onSubmit={handleSubmit} className="form-panel">
                <h2 className="form-panel__title">Nova conta</h2>
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
                    {submitting ? 'Salvando…' : 'Adicionar conta'}
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
        title="Contas"
        subtitle="Contas bancárias de movimentação"
        trailing={
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setShowForm((open) => !open)}
          >
            {showForm ? 'Cancelar' : 'Adicionar conta'}
          </button>
        }
      />

      {showForm ? (
        <form onSubmit={handleSubmit} className="form-panel">
          <h2 className="form-panel__title">Nova conta</h2>
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
              {submitting ? 'Salvando…' : 'Adicionar conta'}
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
        <p className="page__empty">Nenhuma conta cadastrada ainda.</p>
      ) : (
        <ul className="list-rows">
          {items.map((item) => (
            <li key={item.id} className="list-row">
              <div className="list-row__main">
                <span className="list-row__title">{item.label}</span>
                <span className="bank-pill">{item.bank.name}</span>
              </div>
              <div className="list-row__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => void handleDeactivate(item.id)}
                >
                  Desativar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
