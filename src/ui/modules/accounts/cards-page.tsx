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
import { OriginAddCard, OriginCard, OriginCards } from './origin-card';
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
  const cardIdParam = searchParams.get('cardId');
  const invoiceIdParam = searchParams.get('invoiceId');
  const [items, setItems] = useState<Origin[]>([]);
  const [detailCardId, setDetailCardId] = useState<string | null>(null);
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

  const selectedCardId = cardIdParam;
  const selectedCard =
    items.find((item) => item.id === selectedCardId) ?? null;

  const handleInvoiceLoaded = useCallback((detail: InvoiceDetail) => {
    setDetailCardId(detail.cardId);
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

  function openCardInvoices(cardId: string) {
    setSearchParams({ cardId });
  }

  function openInvoiceDetail(invoiceId: string, cardId: string) {
    setSearchParams({ cardId, invoiceId });
  }

  function closeInvoiceDetail() {
    const cardId = cardIdParam ?? detailCardId;
    if (cardId) {
      setSearchParams({ cardId });
      return;
    }
    setSearchParams({});
  }

  function closeCardInvoices() {
    setSearchParams({});
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const cards = await accountsApi.listCards();
      setItems(cards);
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
    if (!items.some((card) => card.id === selectedCardId) && items.length > 0) {
      setSearchParams({});
      return;
    }
    void loadInvoices(selectedCardId);
  }, [selectedCardId, isOnboarding, items, setSearchParams]);

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
      await load();
      await reload();
      refreshOriginsList();
      if (isOnboarding) {
        setStep('success');
        setShowForm(false);
      } else {
        setShowForm(false);
        setSearchParams({ cardId: created.id });
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
      if (selectedCardId === deactivateId) {
        setSearchParams({});
      }
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

  if (selectedCardId) {
    return (
      <section className="page">
        <button
          type="button"
          className="btn btn--ghost invoice-detail__back"
          onClick={closeCardInvoices}
        >
          ← Voltar aos cartões
        </button>

        <PageHeader
          title={selectedCard?.label ?? 'Cartão'}
          subtitle={
            selectedCard
              ? `Faturas · ${selectedCard.bank.name}`
              : 'Faturas do cartão'
          }
          trailing={
            <div className="section__actions">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setShowInvoiceForm(true)}
              >
                Nova fatura
              </button>
              {selectedCard ? (
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={() => setDeactivateId(selectedCard.id)}
                >
                  Desativar cartão
                </button>
              ) : null}
            </div>
          }
        />

        {error && !showInvoiceForm ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="page__empty">Carregando…</p>
        ) : !selectedCard ? (
          <p className="page__empty">Cartão não encontrado.</p>
        ) : (
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
                    onClick={() =>
                      openInvoiceDetail(openInvoice.id, selectedCard.id)
                    }
                  >
                    Ver fatura
                  </button>
                </div>
              ) : null}
            </div>

            <section className="section" aria-labelledby="invoices-heading">
              <div className="section__header">
                <h2 id="invoices-heading" className="section__title">
                  Faturas
                </h2>
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
                <ul className="invoice-cards">
                  {invoices.map((invoice) => (
                    <li key={invoice.id}>
                      <button
                        type="button"
                        className="invoice-card"
                        onClick={() =>
                          openInvoiceDetail(invoice.id, selectedCard.id)
                        }
                      >
                        <div className="invoice-card__title-row">
                          <span className="invoice-card__title">
                            {formatMonth(invoice.referenceMonth)}
                          </span>
                          <span className={statusPillClass(invoice.status)}>
                            {statusLabel(invoice.status)}
                          </span>
                        </div>
                        <span className="invoice-card__meta">
                          Vence {formatDueDate(invoice.dueDate)}
                        </span>
                        <span
                          className={`invoice-card__value${
                            invoice.balance > 0
                              ? ' invoice-card__value--expense'
                              : ''
                          }`}
                        >
                          {formatMoney(invoice.balance)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

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

  return (
    <section className="page">
      <PageHeader
        title="Cartões"
        subtitle="Selecione um cartão para ver as faturas"
      />

      {error && !showForm ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="page__empty">Carregando…</p>
      ) : (
        <OriginCards>
          {items.map((item) => (
            <OriginCard
              key={item.id}
              item={item}
              kind="card"
              onSelect={openCardInvoices}
              onDeactivate={setDeactivateId}
            />
          ))}
          <OriginAddCard
            label="Novo cartão"
            onClick={() => {
              setError(null);
              setShowForm(true);
            }}
          />
        </OriginCards>
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
