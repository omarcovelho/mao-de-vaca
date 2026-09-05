import { useEffect, useState } from 'react';
import { ConfirmModal } from '../../components/confirm-modal';
import { PageHeader } from '../../components/page-header';
import { useToast } from '../../components/toast';
import * as invoicesApi from './api';
import { LinkInvoicePaymentModal } from './link-payment-modal';
import type { InvoiceDetail } from './types';

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

function statusPillClass(status: InvoiceDetail['status']): string {
  if (status === 'open') {
    return 'status-pill status-pill--warning';
  }
  if (status === 'partial') {
    return 'status-pill status-pill--info';
  }
  return 'status-pill status-pill--success';
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
  const [linkBusy, setLinkBusy] = useState(false);
  const [unlinkPaymentId, setUnlinkPaymentId] = useState<string | null>(null);
  const [unlinkBusy, setUnlinkBusy] = useState(false);
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [dueDateDraft, setDueDateDraft] = useState('');
  const [dueDateBusy, setDueDateBusy] = useState(false);
  const [dueDateError, setDueDateError] = useState<string | null>(null);

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

  async function handleConfirmLink(transactionIds: string[]) {
    if (transactionIds.length === 0) {
      return;
    }
    setLinkBusy(true);
    try {
      const next = await invoicesApi.linkPayments(invoiceId, transactionIds);
      setDetail(next);
      onLoaded?.(next);
      setLinking(false);
      toast.success('Pagamento vinculado à fatura.');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Não foi possível vincular o pagamento.';
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
    return (
      <>
        <button
          type="button"
          className="btn btn--ghost invoice-detail__back"
          onClick={onBack}
        >
          ← Faturas
        </button>
        <p className="page__empty">Carregando fatura…</p>
      </>
    );
  }

  if (error || !detail) {
    return (
      <>
        <button
          type="button"
          className="btn btn--ghost invoice-detail__back"
          onClick={onBack}
        >
          ← Faturas
        </button>
        <p className="alert" role="alert">
          {error ?? 'Fatura não encontrada.'}
        </p>
      </>
    );
  }

  const payments = detail.payments ?? [];

  return (
    <>
      <button
        type="button"
        className="btn btn--ghost invoice-detail__back"
        onClick={onBack}
      >
        ← Faturas
      </button>
      <PageHeader
        title={`Fatura ${formatMonth(detail.referenceMonth)}`}
        subtitle={`${detail.card.label} · ${detail.card.bank.name}`}
      />

      <section className="surface-panel" aria-labelledby="invoice-summary-heading">
        <div className="section__header">
          <h2 id="invoice-summary-heading" className="section__title">
            Fatura
          </h2>
        </div>
        <dl className="invoice-summary">
          <div className="invoice-summary__row">
            <dt>Status</dt>
            <dd>
              <span className={statusPillClass(detail.status)}>
                {statusLabel(detail.status)}
              </span>
            </dd>
          </div>
          <div className="invoice-summary__row">
            <dt>Vencimento</dt>
            <dd>
              {editingDueDate ? (
                <div className="invoice-due-date-edit">
                  <input
                    id="invoice-due-date"
                    type="date"
                    value={dueDateDraft}
                    disabled={dueDateBusy}
                    aria-label="Vencimento"
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
                      className="btn btn--primary btn--sm"
                      disabled={dueDateBusy}
                      onClick={() => void handleSaveDueDate()}
                    >
                      {dueDateBusy ? 'Salvando…' : 'Salvar'}
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
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
                <span className="invoice-summary__due">
                  <span>{formatDueDate(detail.dueDate)}</span>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => {
                      setDueDateDraft(detail.dueDate);
                      setEditingDueDate(true);
                      setDueDateError(null);
                    }}
                  >
                    Editar
                  </button>
                </span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="surface-panel" aria-labelledby="invoice-payments-heading">
        <div className="section__header">
          <div>
            <h2 id="invoice-payments-heading" className="section__title">
              Pagamentos
            </h2>
            <p className="section__hint">
              Débitos da conta que baixam esta fatura. Se o vínculo estiver
              errado, remova-o — o débito volta à conta e o caixa é recalculado.
            </p>
          </div>
          {detail.status !== 'paid' ? (
            <div className="section__actions">
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => setLinking(true)}
              >
                Vincular pagamento
              </button>
            </div>
          ) : null}
        </div>

        {payments.length === 0 ? (
          <p className="page__empty">Nenhum pagamento vinculado ainda.</p>
        ) : (
          <ul className="tx-rows tx-rows--invoice">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="tx-row tx-row--compact tx-row--with-action"
              >
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
                  className="btn btn--danger btn--sm tx-row__action"
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
      </section>

      <section className="surface-panel" aria-labelledby="invoice-tx-heading">
        <div className="section__header">
          <h2 id="invoice-tx-heading" className="section__title">
            Lançamentos da fatura
          </h2>
        </div>
        {detail.transactions.length === 0 ? (
          <p className="page__empty">
            Nenhum lançamento nesta fatura ainda. Importe o CSV do cartão.
          </p>
        ) : (
          <ul className="tx-rows tx-rows--invoice">
            {detail.transactions.map((item) => (
              <li key={item.id} className="tx-row tx-row--compact">
                <span className="tx-row__date">
                  {formatDayMonth(item.competenceDate)}
                </span>
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
      </section>

      <LinkInvoicePaymentModal
        open={linking}
        invoice={detail}
        busy={linkBusy}
        onCancel={() => {
          if (!linkBusy) {
            setLinking(false);
          }
        }}
        onConfirm={(transactionIds) => void handleConfirmLink(transactionIds)}
      />

      <ConfirmModal
        open={Boolean(unlinkPaymentId)}
        title="Remover vínculo do pagamento"
        description="Remover o vínculo deste débito com a fatura? Ele volta a ser despesa da conta e o caixa das compras é recalculado."
        confirmLabel="Remover vínculo"
        variant="danger"
        busy={unlinkBusy}
        onCancel={() => {
          if (!unlinkBusy) {
            setUnlinkPaymentId(null);
          }
        }}
        onConfirm={() => void handleConfirmUnlink()}
      />
    </>
  );
}
