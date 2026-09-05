import { FormEvent, useEffect, useMemo, useState } from 'react';
import { FormModal } from '../../components/form-modal';
import { SearchableSelect } from '../../components/searchable-select';
import { listAccounts } from '../accounts/api';
import type { Origin } from '../accounts/types';
import { listTransactions } from '../transactions/api';
import type { TransactionItem } from '../transactions/types';
import type { InvoiceDetail } from './types';

function formatAmount(amount: number): string {
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatDueDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function purchaseTotal(invoice: InvoiceDetail): number {
  return invoice.transactions.reduce((sum, row) => sum + row.amount, 0);
}

type LinkInvoicePaymentModalProps = {
  open: boolean;
  invoice: InvoiceDetail | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (transactionIds: string[]) => void | Promise<void>;
};

export function LinkInvoicePaymentModal({
  open,
  invoice,
  busy = false,
  onCancel,
  onConfirm,
}: LinkInvoicePaymentModalProps) {
  const [accounts, setAccounts] = useState<Origin[]>([]);
  const [accountId, setAccountId] = useState('');
  const [candidates, setCandidates] = useState<TransactionItem[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: `${account.label} (${account.bank.name})`,
      })),
    [accounts],
  );

  const linkedIds = useMemo(
    () => new Set((invoice?.payments ?? []).map((payment) => payment.id)),
    [invoice],
  );

  const invoiceTotal = invoice ? purchaseTotal(invoice) : 0;
  const selectedTotal = candidates
    .filter((item) => selectedIds.includes(item.id))
    .reduce((sum, item) => sum + item.amount, 0);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedIds([]);
    setError(null);
    setCandidates([]);
  }, [open, invoice?.id]);

  useEffect(() => {
    if (!open) {
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
          setError(
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
  }, [open]);

  useEffect(() => {
    if (!open || !accountId || !invoice) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    const dueDate = invoice.dueDate;
    async function loadCandidates() {
      setCandidatesLoading(true);
      setError(null);
      try {
        const from = shiftIsoDate(dueDate, -15);
        const to = shiftIsoDate(dueDate, 15);
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
          setError(
            err instanceof Error
              ? err.message
              : 'Não foi possível buscar lançamentos.',
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
  }, [open, accountId, invoice, linkedIds]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (selectedIds.length === 0 || busy) {
      setError('Selecione ao menos um lançamento.');
      return;
    }
    void onConfirm(selectedIds);
  }

  if (!invoice) {
    return null;
  }

  return (
    <FormModal
      open={open}
      wide
      title="Vincular pagamento"
      busy={busy}
      onClose={onCancel}
    >
      <div className="invoice-link-modal__totals">
        <p>
          <span>Total da fatura</span>
          <strong>{formatAmount(invoiceTotal)}</strong>
        </p>
        {selectedIds.length > 0 ? (
          <p>
            <span>Selecionado</span>
            <strong>{formatAmount(selectedTotal)}</strong>
          </p>
        ) : null}
      </div>
      <p className="confirm-modal__description">
        Escolha o débito da conta que paga esta fatura. Busca lançamentos
        próximos ao vencimento ({formatDueDate(invoice.dueDate)}).
      </p>
      <form className="invoice-link-modal__form" onSubmit={onSubmit}>
        <div className="import-field">
          <span className="import-field__label">Conta</span>
          <SearchableSelect
            aria-label="Conta"
            options={accountOptions}
            value={accountId}
            onChange={setAccountId}
            disabled={accounts.length === 0 || busy}
            placeholder={
              accounts.length === 0 ? 'Nenhuma conta ativa' : 'Selecione…'
            }
          />
        </div>

        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}

        {candidatesLoading ? (
          <p className="page__empty">Buscando lançamentos…</p>
        ) : candidates.length === 0 ? (
          <p className="page__empty">
            Nenhum lançamento elegível neste período. Ajuste a conta ou importe
            o extrato.
          </p>
        ) : (
          <ul
            className="tx-rows tx-rows--invoice tx-rows--invoice-pick"
            aria-label="Lançamentos candidatos"
          >
            {candidates.map((item) => {
              const checked = selectedIds.includes(item.id);
              return (
                <li key={item.id}>
                  <label className="tx-row tx-row--compact tx-row--pick">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={busy}
                      onChange={() => {
                        setSelectedIds((current) =>
                          checked
                            ? current.filter((id) => id !== item.id)
                            : [...current, item.id],
                        );
                      }}
                    />
                    <span className="tx-row__description" title={item.description}>
                      {item.description}
                    </span>
                    <span className="tx-row__date">
                      {formatDueDate(item.competenceDate)}
                    </span>
                    <span className="tx-row__amount tx-row__amount--expense">
                      {formatAmount(item.amount)}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <div className="form-actions">
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
            disabled={busy || selectedIds.length === 0}
          >
            {busy ? 'Vinculando…' : 'Vincular'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
