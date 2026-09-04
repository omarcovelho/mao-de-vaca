import { useEffect, useMemo, useState } from 'react';
import { listAccounts } from '../accounts/api';
import type { Origin } from '../accounts/types';
import { listTransactions } from '../transactions/api';
import type { TransactionItem } from '../transactions/types';
import * as invoicesApi from './api';
import type { InvoiceDetail } from './types';

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

function formatDay(isoDate: string): string {
  const [, , day] = isoDate.split('-');
  return day;
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function statusLabel(status: InvoiceDetail['status']): string {
  if (status === 'open') {
    return 'Aberta';
  }
  if (status === 'partial') {
    return 'Parcial';
  }
  return 'Quitada';
}

function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

type InvoiceDetailPanelProps = {
  invoiceId: string;
  onBack: () => void;
  onLoaded?: (detail: InvoiceDetail) => void;
};

export function InvoiceDetailPanel({
  invoiceId,
  onBack,
  onLoaded,
}: InvoiceDetailPanelProps) {
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [accounts, setAccounts] = useState<Origin[]>([]);
  const [accountId, setAccountId] = useState('');
  const [candidates, setCandidates] = useState<TransactionItem[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);

  const linkedIds = useMemo(
    () => new Set((detail?.payments ?? []).map((payment) => payment.id)),
    [detail],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const next = await invoicesApi.getInvoice(invoiceId);
        if (cancelled) {
          return;
        }
        setDetail(next);
        onLoaded?.(next);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Não foi possível carregar a fatura.',
          );
          setDetail(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [invoiceId, onLoaded]);

  useEffect(() => {
    if (!linking) {
      return;
    }
    let cancelled = false;
    async function loadAccounts() {
      try {
        const list = await listAccounts();
        if (cancelled) {
          return;
        }
        setAccounts(list);
        setAccountId((current) => current || list[0]?.id || '');
      } catch (err) {
        if (!cancelled) {
          setLinkError(
            err instanceof Error
              ? err.message
              : 'Não foi possível carregar as contas.',
          );
        }
      }
    }
    void loadAccounts();
    return () => {
      cancelled = true;
    };
  }, [linking]);

  useEffect(() => {
    if (!linking || !accountId || !detail) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    async function loadCandidates() {
      setCandidatesLoading(true);
      setLinkError(null);
      try {
        const from = shiftIsoDate(detail!.dueDate, -15);
        const to = shiftIsoDate(detail!.dueDate, 15);
        const response = await listTransactions({
          regime: 'competence',
          from,
          to,
          accountId,
        });
        if (cancelled) {
          return;
        }
        setCandidates(
          response.items.filter(
            (item) =>
              item.account &&
              item.amount < 0 &&
              item.type !== 'INVOICE_PAYMENT' &&
              !linkedIds.has(item.id),
          ),
        );
        setSelectedIds([]);
      } catch (err) {
        if (!cancelled) {
          setLinkError(
            err instanceof Error
              ? err.message
              : 'Não foi possível buscar débitos.',
          );
          setCandidates([]);
        }
      } finally {
        if (!cancelled) {
          setCandidatesLoading(false);
        }
      }
    }
    void loadCandidates();
    return () => {
      cancelled = true;
    };
  }, [linking, accountId, detail, linkedIds]);

  async function handleConfirmLink() {
    if (selectedIds.length === 0) {
      setLinkError('Selecione ao menos um débito.');
      return;
    }
    setLinkBusy(true);
    setLinkError(null);
    try {
      const next = await invoicesApi.linkPayments(invoiceId, selectedIds);
      setDetail(next);
      onLoaded?.(next);
      setLinking(false);
      setSelectedIds([]);
    } catch (err) {
      setLinkError(
        err instanceof Error
          ? err.message
          : 'Não foi possível vincular o pagamento.',
      );
    } finally {
      setLinkBusy(false);
    }
  }

  if (loading) {
    return <p className="page__empty">Carregando fatura…</p>;
  }

  if (error || !detail) {
    return (
      <div className="section">
        <p className="alert" role="alert">
          {error ?? 'Fatura não encontrada.'}
        </p>
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          Voltar às faturas
        </button>
      </div>
    );
  }

  return (
    <section className="section" aria-labelledby="invoice-detail-heading">
      <div className="section__header">
        <div>
          <button type="button" className="btn btn--ghost btn--compact" onClick={onBack}>
            ← Faturas
          </button>
          <h2 id="invoice-detail-heading" className="section__title">
            Fatura {formatMonth(detail.referenceMonth)}
          </h2>
          <p className="section__hint">
            {detail.card.label} · {detail.card.bank.name} · vence{' '}
            {formatDueDate(detail.dueDate)} · {statusLabel(detail.status)} ·{' '}
            {formatMoney(detail.balance)}
          </p>
        </div>
        {detail.status !== 'paid' ? (
          <div className="section__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setLinking((current) => !current);
                setLinkError(null);
              }}
            >
              {linking ? 'Cancelar' : 'Vincular pagamento'}
            </button>
          </div>
        ) : null}
      </div>

      {linking ? (
        <div className="section invoice-link-panel">
          <h3 className="section__title">Vincular débito da conta</h3>
          <p className="section__hint">
            Busca débitos próximos ao vencimento ({formatDueDate(detail.dueDate)}
            ). O lançamento passa a ser pagamento de fatura.
          </p>
          <div className="form-stack">
            <span className="form-label">Conta</span>
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              disabled={accounts.length === 0 || linkBusy}
            >
              {accounts.length === 0 ? (
                <option value="">Nenhuma conta ativa</option>
              ) : (
                accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label} ({account.bank.name})
                  </option>
                ))
              )}
            </select>
          </div>

          {candidatesLoading ? (
            <p className="page__empty">Buscando débitos…</p>
          ) : candidates.length === 0 ? (
            <p className="page__empty">
              Nenhum débito elegível neste período. Ajuste a conta ou importe o
              extrato.
            </p>
          ) : (
            <ul className="tx-rows tx-rows--invoice">
              {candidates.map((item) => {
                const checked = selectedIds.includes(item.id);
                return (
                  <li key={item.id} className="tx-row tx-row--compact">
                    <label className="tx-row__description">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={linkBusy}
                        onChange={() => {
                          setSelectedIds((current) =>
                            checked
                              ? current.filter((id) => id !== item.id)
                              : [...current, item.id],
                          );
                        }}
                      />{' '}
                      {item.description}
                    </label>
                    <span className="tx-row__date">
                      {formatDueDate(item.competenceDate)}
                    </span>
                    <span className="tx-row__amount tx-row__amount--expense">
                      {formatAmount(item.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {linkError ? (
            <p className="alert" role="alert">
              {linkError}
            </p>
          ) : null}

          <div className="section__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={linkBusy || selectedIds.length === 0}
              onClick={() => {
                void handleConfirmLink();
              }}
            >
              {linkBusy ? 'Vinculando…' : 'Confirmar vínculo'}
            </button>
          </div>
        </div>
      ) : null}

      <h3 className="section__title">Pagamentos vinculados</h3>
      {(detail.payments ?? []).length === 0 ? (
        <p className="page__empty">Nenhum pagamento vinculado ainda.</p>
      ) : (
        <ul className="tx-rows tx-rows--invoice">
          {(detail.payments ?? []).map((payment) => (
            <li key={payment.id} className="tx-row tx-row--compact">
              <span className="tx-row__date">
                {formatDay(payment.competenceDate)}
              </span>
              <span className="tx-row__description" title={payment.description}>
                {payment.description}
              </span>
              <span className="tx-row__category">
                {payment.account.label} · {payment.account.bank.name}
              </span>
              <span className="tx-row__amount tx-row__amount--expense">
                {formatAmount(payment.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="section__title">Lançamentos da fatura</h3>
      {detail.transactions.length === 0 ? (
        <p className="page__empty">
          Nenhum lançamento nesta fatura ainda. Importe o CSV do cartão.
        </p>
      ) : (
        <ul className="tx-rows tx-rows--invoice">
          {detail.transactions.map((item) => (
            <li key={item.id} className="tx-row tx-row--compact">
              <span className="tx-row__date">{formatDay(item.competenceDate)}</span>
              <span className="tx-row__description" title={item.description}>
                {item.description}
              </span>
              <span className="tx-row__category">{item.category.name}</span>
              <span
                className={`tx-row__amount${
                  item.amount < 0 ? ' tx-row__amount--expense' : ''
                }`}
              >
                {formatAmount(item.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
