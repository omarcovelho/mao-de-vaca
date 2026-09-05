import { FormEvent, useEffect, useState } from 'react';
import { ConfirmModal } from '../../components/confirm-modal';
import { FormModal } from '../../components/form-modal';
import { AccountOriginIcon } from '../../components/origin-icon';
import { PageHeader } from '../../components/page-header';
import { useToast } from '../../components/toast';
import { TrashGlyph } from '../categories/category-icons';
import * as accountsApi from './api';
import { BankFields } from './bank-fields';
import { OnboardingContinue } from './onboarding-continue';
import { OnboardingFinalizeButton } from './onboarding-finalize-button';
import { OnboardingOriginsList } from './onboarding-origins-list';
import { OnboardingSetupHeader } from './onboarding-setup-header';
import { useSetupStatus } from './setup-status-context';
import type { Origin } from './types';

export function AccountsPage() {
  const toast = useToast();
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
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);

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

  async function runDeactivate() {
    if (!deactivateId) {
      return;
    }
    setDeactivating(true);
    setError(null);
    try {
      await accountsApi.deactivateAccount(deactivateId);
      setDeactivateId(null);
      await load();
      toast.success('Conta desativada.');
    } catch {
      const message = 'Não foi possível desativar a conta.';
      setError(message);
      toast.error(message);
    } finally {
      setDeactivating(false);
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

  function closeCreateModal() {
    if (submitting) {
      return;
    }
    setShowForm(false);
    setError(null);
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
            onClick={() => {
              setError(null);
              setShowForm(true);
            }}
          >
            Adicionar conta
          </button>
        }
      />

      {error && !showForm ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="page__empty">Carregando…</p>
      ) : items.length === 0 ? (
        <div className="surface-panel surface-panel--empty">
          <p className="page__empty" style={{ margin: 0 }}>
            Nenhuma conta cadastrada ainda.
          </p>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => {
              setError(null);
              setShowForm(true);
            }}
          >
            Adicionar conta
          </button>
        </div>
      ) : (
        <div className="surface-panel">
          <ul className="list-rows">
            {items.map((item) => (
              <li key={item.id} className="list-row origin-row">
                <div className="origin-row__identity">
                  <span className="origin-row__icon" aria-hidden>
                    <AccountOriginIcon />
                  </span>
                  <div className="list-row__main">
                    <div className="list-row__title-row">
                      <span className="list-row__title">{item.label}</span>
                      <span className="bank-pill">{item.bank.name}</span>
                    </div>
                  </div>
                </div>
                <div className="list-row__actions">
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon btn--icon-danger"
                    aria-label={`Desativar ${item.label}`}
                    onClick={() => setDeactivateId(item.id)}
                  >
                    <TrashGlyph />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <FormModal
        open={showForm}
        title="Nova conta"
        description="Conta bancária usada como origem de lançamentos."
        busy={submitting}
        onClose={closeCreateModal}
      >
        <form onSubmit={handleSubmit} className="form-stack">
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
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--ghost"
              disabled={submitting}
              onClick={closeCreateModal}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting || !bankId}
            >
              {submitting ? 'Salvando…' : 'Adicionar conta'}
            </button>
          </div>
        </form>
      </FormModal>

      <ConfirmModal
        open={deactivateId !== null}
        title="Desativar conta"
        description={
          deactivateId
            ? `Desativar “${items.find((item) => item.id === deactivateId)?.label ?? 'esta conta'}”? Ela deixa de aparecer nas origens ativas.`
            : null
        }
        confirmLabel="Desativar"
        variant="danger"
        busy={deactivating}
        onCancel={() => {
          if (!deactivating) {
            setDeactivateId(null);
          }
        }}
        onConfirm={() => void runDeactivate()}
      />
    </section>
  );
}
