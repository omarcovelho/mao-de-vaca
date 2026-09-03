import { useEffect, useState } from 'react';
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
      </div>

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
