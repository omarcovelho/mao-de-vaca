import { FormEvent, useEffect, useId, useState } from 'react';
import * as transactionsApi from './api';
import type { TransactionItem } from './types';

type LinkTransferModalProps = {
  open: boolean;
  source: TransactionItem | null;
  categoryId: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (counterpartId: string) => void | Promise<void>;
};

function formatAmount(amount: number): string {
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(year, month - 1, day));
}

export function LinkTransferModal({
  open,
  source,
  categoryId,
  busy = false,
  onCancel,
  onConfirm,
}: LinkTransferModalProps) {
  const titleId = useId();
  const [amountQuery, setAmountQuery] = useState('');
  const [candidates, setCandidates] = useState<TransactionItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !source) {
      return;
    }
    setAmountQuery(String(Math.abs(source.amount)));
    setSelectedId('');
    setError(null);
  }, [open, source]);

  useEffect(() => {
    if (!open || !source) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await transactionsApi.listTransferCandidates({
          transactionId: source.id,
          amount: amountQuery || undefined,
        });
        if (!cancelled) {
          setCandidates(response.items);
        }
      } catch (err) {
        if (!cancelled) {
          setCandidates([]);
          setError(
            err instanceof Error
              ? err.message
              : 'Falha ao buscar candidatos',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [amountQuery, open, source]);

  if (!open || !source) {
    return null;
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || busy) {
      return;
    }
    void onConfirm(selectedId);
  }

  return (
    <div
      className="confirm-modal__backdrop"
      data-testid="link-transfer-modal"
      onClick={() => {
        if (!busy) {
          onCancel();
        }
      }}
    >
      <div
        className="confirm-modal__dialog confirm-modal__dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="confirm-modal__title">
          Vincular transferência
        </h2>
        <p className="confirm-modal__description">
          Selecione o lançamento correspondente a{' '}
          <strong>{source.description}</strong> (
          {formatAmount(source.amount)}).
        </p>
        <form className="form-stack" onSubmit={onSubmit}>
          <label>
            Buscar por valor
            <input
              type="text"
              inputMode="decimal"
              value={amountQuery}
              onChange={(event) => setAmountQuery(event.target.value)}
              aria-label="Valor para buscar"
              disabled={busy}
            />
          </label>
          {error ? (
            <p className="alert" role="alert">
              {error}
            </p>
          ) : null}
          {loading ? (
            <p className="page__empty">Buscando…</p>
          ) : candidates.length === 0 ? (
            <p className="page__empty">Nenhum lançamento encontrado.</p>
          ) : (
            <ul
              className="tx-rows tx-rows--transfer-pick"
              role="listbox"
              aria-label="Candidatos"
            >
              {candidates.map((item) => {
                const selected = selectedId === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`tx-row tx-row--pick${
                        selected ? ' tx-row--selected' : ''
                      }`}
                      onClick={() => setSelectedId(item.id)}
                      disabled={busy}
                    >
                      <span className="tx-row__date">
                        {formatDay(item.displayDate)}
                      </span>
                      <span
                        className="tx-row__description"
                        title={item.description}
                      >
                        {item.description}
                      </span>
                      <span
                        className="tx-row__account"
                        title={item.account?.label ?? undefined}
                      >
                        <span className="tx-row__account-label">
                          {item.account?.label ?? '—'}
                        </span>
                      </span>
                      <span className="tx-row__amount">
                        {formatAmount(item.amount)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="confirm-modal__actions">
            <button
              type="button"
              className="btn btn--secondary"
              disabled={busy}
              onClick={onCancel}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={busy || !selectedId || !categoryId}
            >
              {busy ? 'Vinculando…' : 'Vincular'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
