import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ConfirmModal } from '../../components/confirm-modal';
import { FormModal } from '../../components/form-modal';
import { PageHeader } from '../../components/page-header';
import { useToast } from '../../components/toast';
import * as accountsApi from './api';
import { BankFields } from './bank-fields';
import { OnboardingContinue } from './onboarding-continue';
import { OnboardingFinalizeButton } from './onboarding-finalize-button';
import { OnboardingOriginsList } from './onboarding-origins-list';
import { OnboardingSetupHeader } from './onboarding-setup-header';
import { useSetupStatus } from './setup-status-context';
import type { Origin } from './types';
import * as invoicesApi from '../invoices/api';
import { InvoiceDetailPanel } from '../invoices/invoice-detail-panel';
import type { Invoice, InvoiceDetail } from '../invoices/types';

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatMonth(isoDate: string): string {
  if (!isoDate) {
    return '—';
  }
  const [year, month] = isoDate.slice(0, 7).split('-');
  const labels = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];
  const index = Number(month) - 1;
  return `${labels[index] ?? month}/${year}`;
}

function formatDueDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function statusLabel(status: Invoice['status']): string {
  if (status === 'open') {
    return 'Aberta';
  }
  if (status === 'partial') {
    return 'Parcial';
  }
  return 'Quitada';
}

function statusPillClass(status: Invoice['status']): string {
  if (status === 'open') {
    return 'status-pill status-pill--warning';
  }
  if (status === 'partial') {
    return 'status-pill status-pill--info';
  }
  return 'status-pill status-pill--success';
}

export function CardsPage() {
  const toast = useToast();
  const { reload, isOnboardingComplete, startOnboarding } = useSetupStatus();
  const isOnboarding = !isOnboardingComplete;
  const [searchParams, setSearchParams] = useSearchParams();
  const invoiceIdParam = searchParams.get('invoiceId');
  const [items, setItems] = useState<Origin[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [label, setLabel] = useState('');
  const [bankId, setBankId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(isOnboarding);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [referenceMonth, setReferenceMonth] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [originsRefreshKey, setOriginsRefreshKey] = useState(0);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const handleInvoiceLoaded = useCallback((detail: InvoiceDetail) => {
    setSelectedCardId(detail.cardId);
    setInvoices((current) =>
      current.map((invoice) =>
        invoice.id === detail.id
          ? {
              ...invoice,
              balance: detail.balance,
              status: detail.status,
            }
          : invoice,
      ),
    );
  }, []);

  function openInvoiceDetail(invoiceId: string) {
    setSearchParams({ invoiceId });
  }

  function closeInvoiceDetail() {
    setSearchParams({});
  }

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

  async function loadInvoices(cardId: string) {
    setInvoicesLoading(true);
    try {
      const list = await invoicesApi.listInvoices(cardId);
      setInvoices(Array.isArray(list) ? list : []);
    } catch {
      setError('Não foi possível carregar as faturas.');
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
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

  useEffect(() => {
    if (!selectedCardId || isOnboarding) {
      setInvoices([]);
      return;
    }
    void loadInvoices(selectedCardId);
  }, [selectedCardId, isOnboarding]);

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

  async function handleCreateInvoice(event: FormEvent) {
    event.preventDefault();
    if (!selectedCardId) {
      return;
    }
    setInvoiceSubmitting(true);
    setError(null);
    try {
      await invoicesApi.createInvoice(selectedCardId, {
        referenceMonth,
        dueDate,
      });
      setReferenceMonth('');
      setDueDate('');
      setShowInvoiceForm(false);
      await loadInvoices(selectedCardId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível criar a fatura.',
      );
    } finally {
      setInvoiceSubmitting(false);
    }
  }

  async function runDeactivate() {
    if (!deactivateId) {
      return;
    }
    setDeactivating(true);
    setError(null);
    try {
      await accountsApi.deactivateCard(deactivateId);
      setDeactivateId(null);
      await load();
      toast.success('Cartão desativado.');
    } catch {
      const message = 'Não foi possível desativar o cartão.';
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

  const selectedCard =
    items.find((item) => item.id === selectedCardId) ?? items[0] ?? null;

  const openInvoice =
    invoices.find((invoice) => invoice.status === 'open') ??
    invoices.find((invoice) => invoice.status === 'partial') ??
    null;

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

  function closeCardModal() {
    if (submitting) {
      return;
    }
    setShowForm(false);
    setError(null);
  }

  function closeInvoiceModal() {
    if (invoiceSubmitting) {
      return;
    }
    setShowInvoiceForm(false);
  }

  if (invoiceIdParam) {
    return (
      <section className="page">
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}
        <InvoiceDetailPanel
          invoiceId={invoiceIdParam}
          onBack={closeInvoiceDetail}
          onLoaded={handleInvoiceLoaded}
        />
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
            onClick={() => {
              setError(null);
              setShowForm(true);
            }}
          >
            Adicionar cartão
          </button>
        }
      />

      {error && !showForm && !showInvoiceForm ? (
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
                onClick={() => {
                  setSelectedCardId(item.id);
                }}
                aria-pressed={selectedCard?.id === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>

          {selectedCard ? (
            <>
              <div className="hero-metric">
                <p className="panel__eyebrow">Saldo em aberto</p>
                <p
                  className={`hero-metric__value${
                    openInvoice && openInvoice.balance > 0
                      ? ' hero-metric__value--expense'
                      : ''
                  }`}
                >
                  {openInvoice ? formatMoney(openInvoice.balance) : '—'}
                </p>
                <p className="hero-metric__label">
                  {openInvoice
                    ? `Fatura ${formatMonth(openInvoice.referenceMonth)} · vence ${formatDueDate(openInvoice.dueDate)}`
                    : selectedCard.label}
                </p>
                {openInvoice ? (
                  <div className="hero-metric__meta">
                    <span className={statusPillClass(openInvoice.status)}>
                      {statusLabel(openInvoice.status)}
                    </span>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => openInvoiceDetail(openInvoice.id)}
                    >
                      Ver fatura
                    </button>
                  </div>
                ) : null}
              </div>

              <section className="section" aria-labelledby="invoices-heading">
                <div className="section__header">
                  <h2 id="invoices-heading" className="section__title">
                    Faturas · {selectedCard.label}
                  </h2>
                  <div className="section__actions">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => setShowInvoiceForm(true)}
                    >
                      Nova fatura
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={() => setDeactivateId(selectedCard.id)}
                    >
                      Desativar cartão
                    </button>
                  </div>
                </div>

                {invoicesLoading ? (
                  <p className="page__empty">Carregando faturas…</p>
                ) : invoices.length === 0 ? (
                  <div className="surface-panel">
                    <p className="page__empty" style={{ margin: 0 }}>
                      Nenhuma fatura ainda.
                    </p>
                    <div className="section__actions" style={{ marginTop: '1rem' }}>
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        onClick={() => setShowInvoiceForm(true)}
                      >
                        Nova fatura
                      </button>
                      <Link to="/importar" className="btn btn--secondary btn--sm">
                        Importar CSV
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="surface-panel">
                    <ul className="list-rows">
                      {invoices.map((invoice) => (
                        <li key={invoice.id} className="list-row">
                          <div className="list-row__main">
                            <div className="list-row__title-row">
                              <span className="list-row__title">
                                {formatMonth(invoice.referenceMonth)}
                              </span>
                              <span className={statusPillClass(invoice.status)}>
                                {statusLabel(invoice.status)}
                              </span>
                            </div>
                            <span className="list-row__meta">
                              Vence {formatDueDate(invoice.dueDate)}
                            </span>
                          </div>
                          <div className="list-row__actions">
                            <span
                              className={`list-row__value${
                                invoice.balance > 0 ? ' list-row__value--expense' : ''
                              }`}
                            >
                              {formatMoney(invoice.balance)}
                            </span>
                            <button
                              type="button"
                              className="btn btn--secondary btn--sm"
                              onClick={() => openInvoiceDetail(invoice.id)}
                            >
                              Ver
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </>
          ) : null}
        </>
      )}

      <FormModal
        open={showForm}
        title="Novo cartão"
        description="Cartão de crédito vinculado a um banco."
        busy={submitting}
        onClose={closeCardModal}
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
              onClick={closeCardModal}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting || !bankId}
            >
              {submitting ? 'Salvando…' : 'Adicionar cartão'}
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={showInvoiceForm}
        title="Nova fatura"
        description="Cria a fatura para o cartão selecionado."
        busy={invoiceSubmitting}
        onClose={closeInvoiceModal}
      >
        <form onSubmit={handleCreateInvoice} className="form-stack">
          <label>
            Mês de referência
            <input
              type="month"
              name="referenceMonth"
              value={referenceMonth}
              onChange={(event) => setReferenceMonth(event.target.value)}
              required
            />
          </label>
          <label>
            Vencimento
            <input
              type="date"
              name="dueDate"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              required
            />
          </label>
          {error ? <p role="alert">{error}</p> : null}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--ghost"
              disabled={invoiceSubmitting}
              onClick={closeInvoiceModal}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={invoiceSubmitting}
            >
              {invoiceSubmitting ? 'Salvando…' : 'Criar fatura'}
            </button>
          </div>
        </form>
      </FormModal>

      <ConfirmModal
        open={deactivateId !== null}
        title="Desativar cartão"
        description={
          deactivateId
            ? `Desativar “${items.find((item) => item.id === deactivateId)?.label ?? 'este cartão'}”? Ele deixa de aparecer nas origens ativas.`
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
