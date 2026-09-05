import { useEffect, useMemo, useState } from 'react';
import { ConfirmModal } from '../../components/confirm-modal';
import { SearchableSelect } from '../../components/searchable-select';
import { useToast } from '../../components/toast';
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

function formatDayMonth(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${day}/${month}`;
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
  const toast = useToast();
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
  const [confirmLinkOpen, setConfirmLinkOpen] = useState(false);
  const [unlinkPaymentId, setUnlinkPaymentId] = useState<string | null>(null);
  const [unlinkBusy, setUnlinkBusy] = useState(false);
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [dueDateDraft, setDueDateDraft] = useState('');
  const [dueDateBusy, setDueDateBusy] = useState(false);
  const [dueDateError, setDueDateError] = useState<string | null>(null);

  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: `${account.label} (${account.bank.name})`,
      })),
    [accounts],
  );

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
        setDueDateDraft(next.dueDate);
        setEditingDueDate(false);
        setDueDateError(null);
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
      setConfirmLinkOpen(false);
      toast.success('Pagamento vinculado à fatura.');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Não foi possível vincular o pagamento.';
      setLinkError(message);
      toast.error(message);
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleConfirmUnlink() {
    if (!unlinkPaymentId) {
      return;
    }
    setUnlinkBusy(true);
    try {
      const next = await invoicesApi.unlinkPayment(invoiceId, unlinkPaymentId);
      setDetail(next);
      onLoaded?.(next);
      setUnlinkPaymentId(null);
      toast.success('Pagamento desvinculado.');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Não foi possível desvincular o pagamento.';
      toast.error(message);
    } finally {
      setUnlinkBusy(false);
    }
  }

  async function handleSaveDueDate() {
    if (!dueDateDraft.trim()) {
      setDueDateError('Informe a data de vencimento.');
      return;
    }
    setDueDateBusy(true);
    setDueDateError(null);
    try {
      const next = await invoicesApi.updateInvoice(invoiceId, {
        dueDate: dueDateDraft,
      });
      setDetail(next);
      setDueDateDraft(next.dueDate);
      setEditingDueDate(false);
      onLoaded?.(next);
    } catch (err) {
      setDueDateError(
        err instanceof Error
          ? err.message
          : 'Não foi possível atualizar o vencimento.',
      );
    } finally {
      setDueDateBusy(false);
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
            {detail.card.label} · {detail.card.bank.name} ·{' '}
            {statusLabel(detail.status)} · {formatMoney(detail.balance)}
          </p>
          {editingDueDate ? (
            <div className="invoice-due-date-edit form-stack">
              <label htmlFor="invoice-due-date">Vencimento</label>
              <input
                id="invoice-due-date"
                type="date"
                value={dueDateDraft}
                disabled={dueDateBusy}
                onChange={(event) => setDueDateDraft(event.target.value)}
              />
              {dueDateError ? (
                <p className="alert" role="alert">
                  {dueDateError}
                </p>
              ) : null}
              <div className="section__actions">
                <button
                  type="button"
                  className="btn btn--primary btn--compact"
                  disabled={dueDateBusy}
                  onClick={() => void handleSaveDueDate()}
                >
                  {dueDateBusy ? 'Salvando…' : 'Salvar vencimento'}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--compact"
                  disabled={dueDateBusy}
                  onClick={() => {
                    setEditingDueDate(false);
                    setDueDateDraft(detail.dueDate);
                    setDueDateError(null);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <p className="section__hint">
              Vence {formatDueDate(detail.dueDate)}{' '}
              <button
                type="button"
                className="btn btn--ghost btn--compact"
                onClick={() => {
                  setDueDateDraft(detail.dueDate);
                  setEditingDueDate(true);
                  setDueDateError(null);
                }}
              >
                Editar
              </button>
            </p>
          )}
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
        ) : (detail.payments ?? []).length > 0 ? (
          <p className="section__hint section__hint--actions">
            Errou o débito? Remova o vínculo em Pagamentos abaixo.
          </p>
        ) : null}
      </div>

      <h3 className="section__title">Pagamentos vinculados</h3>
      <p className="section__hint">
        Débitos da conta que baixam o saldo desta fatura. Se vinculou o
        lançamento errado, remova o vínculo — o débito volta à conta e o caixa
        das compras é recalculado.
      </p>
      {(detail.payments ?? []).length === 0 ? (
        <p className="page__empty">Nenhum pagamento vinculado ainda.</p>
      ) : (
        <ul className="tx-rows tx-rows--invoice">
          {(detail.payments ?? []).map((payment) => (
            <li key={payment.id} className="tx-row tx-row--compact tx-row--with-action">
              <span className="tx-row__date">
                {formatDayMonth(payment.competenceDate)}
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
              <button
                type="button"
                className="btn btn--secondary btn--compact tx-row__action"
                disabled={unlinkBusy}
                aria-label={`Remover vínculo de ${payment.description}`}
                onClick={() => setUnlinkPaymentId(payment.id)}
              >
                Remover vínculo
              </button>
            </li>
          ))}
        </ul>
      )}

      {linking ? (
        <div className="section invoice-link-panel">
          <h3 className="section__title">Vincular débito da conta</h3>
          <p className="section__hint">
            Busca débitos próximos ao vencimento ({formatDueDate(detail.dueDate)}
            ). O lançamento passa a ser pagamento de fatura.
          </p>
          <div className="form-stack">
            <span className="form-label">Conta</span>
            <SearchableSelect
              aria-label="Conta"
              options={accountOptions}
              value={accountId}
              onChange={setAccountId}
              disabled={accounts.length === 0 || linkBusy}
              placeholder={
                accounts.length === 0 ? 'Nenhuma conta ativa' : 'Selecione…'
              }
            />
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
                  <li key={item.id} className="tx-row tx-row--compact tx-row--pick">
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
              onClick={() => setConfirmLinkOpen(true)}
            >
              {linkBusy ? 'Vinculando…' : 'Confirmar vínculo'}
            </button>
          </div>
        </div>
      ) : null}

      <h3 className="section__title">Lançamentos da fatura</h3>
      {detail.transactions.length === 0 ? (
        <p className="page__empty">
          Nenhum lançamento nesta fatura ainda. Importe o CSV do cartão.
        </p>
      ) : (
        <ul className="tx-rows tx-rows--invoice">
          {detail.transactions.map((item) => (
            <li key={item.id} className="tx-row tx-row--compact">
              <span className="tx-row__date">{formatDayMonth(item.competenceDate)}</span>
              <span className="tx-row__description" title={item.description}>
                {item.description}
              </span>
              <span className="tx-row__category">
                {item.category?.name ?? 'Sem categoria'}
              </span>
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

      <ConfirmModal
        open={confirmLinkOpen}
        title="Vincular pagamento"
        description={`Vincular ${selectedIds.length} débito(s) a esta fatura? O lançamento passa a ser tratado como pagamento de fatura.`}
        confirmLabel="Vincular"
        busy={linkBusy}
        onCancel={() => {
          if (!linkBusy) {
            setConfirmLinkOpen(false);
          }
        }}
        onConfirm={() => void handleConfirmLink()}
      />

      <ConfirmModal
        open={Boolean(unlinkPaymentId)}
        title="Remover vínculo do pagamento"
        description="Remover o vínculo deste débito com a fatura? Ele volta a ser despesa da conta e o caixa das compras é recalculado."
        confirmLabel="Remover vínculo"
        busy={unlinkBusy}
        onCancel={() => {
          if (!unlinkBusy) {
            setUnlinkPaymentId(null);
          }
        }}
        onConfirm={() => void handleConfirmUnlink()}
      />
    </section>
  );
}
