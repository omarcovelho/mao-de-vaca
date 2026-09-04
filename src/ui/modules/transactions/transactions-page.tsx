import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  flattenCategoryLeaves,
  type CategoryLeafOption,
} from '../../components/category-leaves';
import { ConfirmModal } from '../../components/confirm-modal';
import { PageHeader } from '../../components/page-header';
import {
  AccountOriginIcon,
  CardOriginIcon,
} from '../../components/origin-icon';
import { RegimeToggle } from '../../components/regime-toggle';
import { SearchableSelect } from '../../components/searchable-select';
import { useToast } from '../../components/toast';
import { listAccounts } from '../accounts/api';
import type { Origin } from '../accounts/types';
import { listCategories } from '../categories/api';
import * as transactionsApi from './api';
import { formatMonthLabel, monthBounds, shiftMonth, toMonthKey } from './month';
import { useRegime } from './regime-context';
import type { TransactionItem } from './types';

const MONTH_RE = /^\d{4}-\d{2}$/;

function formatAmount(amount: number, type: TransactionItem['type']): string {
  const signed =
    type === 'EXPENSE' ? -Math.abs(amount) : type === 'INCOME' ? Math.abs(amount) : amount;
  return signed.toLocaleString('pt-BR', {
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

function initialMonth(searchParams: URLSearchParams): string {
  const fromQuery = searchParams.get('month');
  if (fromQuery && MONTH_RE.test(fromQuery)) {
    return fromQuery;
  }
  return toMonthKey();
}

export function TransactionsPage() {
  const toast = useToast();
  const { regime, setRegime } = useRegime();
  const [searchParams] = useSearchParams();
  const [month, setMonth] = useState(() => initialMonth(searchParams));
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [categoryId, setCategoryId] = useState(
    () => searchParams.get('categoryId') ?? '',
  );
  const [accountId, setAccountId] = useState('');
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [accounts, setAccounts] = useState<Origin[]>([]);
  const [leaves, setLeaves] = useState<CategoryLeafOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);

  useEffect(() => {
    const nextMonth = searchParams.get('month');
    if (nextMonth && MONTH_RE.test(nextMonth)) {
      setMonth(nextMonth);
      setCustomFrom('');
      setCustomTo('');
    }
    const nextCategory = searchParams.get('categoryId');
    if (nextCategory !== null) {
      setCategoryId(nextCategory);
    }
  }, [searchParams]);

  const period = useMemo(() => {
    if (customFrom && customTo) {
      return { from: customFrom, to: customTo };
    }
    return monthBounds(month);
  }, [customFrom, customTo, month]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [accountList, tree] = await Promise.all([
          listAccounts(),
          listCategories(),
        ]);
        if (cancelled) {
          return;
        }
        setAccounts(accountList);
        setLeaves(flattenCategoryLeaves(tree));
      } catch {
        if (!cancelled) {
          setError('Não foi possível carregar filtros.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await transactionsApi.listTransactions({
          regime,
          from: period.from,
          to: period.to,
          categoryId: categoryId || undefined,
          accountId: accountId || undefined,
        });
        if (!cancelled) {
          setItems(response.items);
        }
      } catch {
        if (!cancelled) {
          setError('Não foi possível carregar os lançamentos.');
          setItems([]);
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
  }, [regime, period.from, period.to, categoryId, accountId]);

  const categoryFilterOptions = useMemo(
    () => leaves.map((leaf) => ({ value: leaf.value, label: leaf.label })),
    [leaves],
  );

  const accountFilterOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: account.label,
      })),
    [accounts],
  );

  async function handleCategoryChange(id: string, nextCategoryId: string) {
    setBusyId(id);
    setError(null);
    try {
      const updated = await transactionsApi.updateTransaction(id, {
        categoryId: nextCategoryId,
      });
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                category: updated.category,
                active: updated.active,
              }
            : item,
        ),
      );
      setEditingId(null);
      toast.success('Categoria atualizada.');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Falha ao alterar categoria';
      setError(message);
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  }

  async function runDeactivate() {
    if (!deactivateId) {
      return;
    }
    const id = deactivateId;
    setBusyId(id);
    setError(null);
    try {
      await transactionsApi.updateTransaction(id, { active: false });
      setItems((current) => current.filter((item) => item.id !== id));
      setDeactivateId(null);
      toast.success('Lançamento desativado.');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Falha ao desativar lançamento';
      setError(message);
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  }

  function onApplyFilters(event: FormEvent) {
    event.preventDefault();
  }

  function clearExtraFilters() {
    setCategoryId('');
    setAccountId('');
    setCustomFrom('');
    setCustomTo('');
  }

  const deactivateTarget = items.find((item) => item.id === deactivateId);

  return (
    <section className="page">
      <PageHeader
        title={formatMonthLabel(month)}
        subtitle="Lançamentos do período"
        trailing={
          <div className="page-header__actions">
            <div className="month-nav" role="group" aria-label="Mês">
              <button
                type="button"
                className="btn btn--ghost btn--compact"
                onClick={() => setMonth((current) => shiftMonth(current, -1))}
                aria-label="Mês anterior"
              >
                ‹
              </button>
              <input
                type="month"
                className="month-nav__input"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                aria-label="Selecionar mês"
              />
              <button
                type="button"
                className="btn btn--ghost btn--compact"
                onClick={() => setMonth((current) => shiftMonth(current, 1))}
                aria-label="Próximo mês"
              >
                ›
              </button>
            </div>
            <RegimeToggle value={regime} onChange={setRegime} />
          </div>
        }
      />

      <form className="form-panel filters-panel" onSubmit={onApplyFilters}>
        <div className="form-stack filters-panel__grid">
          <label>
            Categoria
            <SearchableSelect
              aria-label="Filtro de categoria"
              options={categoryFilterOptions}
              value={categoryId}
              onChange={setCategoryId}
              allowEmpty
              emptyLabel="Todas"
            />
          </label>
          <label>
            Conta
            <SearchableSelect
              aria-label="Filtro de conta"
              options={accountFilterOptions}
              value={accountId}
              onChange={setAccountId}
              allowEmpty
              emptyLabel="Todas"
            />
          </label>
          <label>
            Data de
            <input
              type="date"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
            />
          </label>
          <label>
            Data até
            <input
              type="date"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
            />
          </label>
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={clearExtraFilters}
          >
            Limpar filtros
          </button>
        </div>
      </form>

      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="page__empty">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="page__empty">Nenhum lançamento neste período.</p>
      ) : (
        <ul className="tx-rows">
          {items.map((item) => {
            const leafOptions = leaves
              .filter((leaf) => {
                if (item.type === 'EXPENSE') {
                  return leaf.kind === 'EXPENSE';
                }
                if (item.type === 'INCOME') {
                  return leaf.kind === 'INCOME';
                }
                return true;
              })
              .map((leaf) => ({ value: leaf.value, label: leaf.label }));
            return (
              <li key={item.id} className="tx-row">
                <span className="tx-row__date">{formatDay(item.displayDate)}</span>
                <span className="tx-row__description" title={item.description}>
                  {item.description}
                </span>
                {editingId === item.id ? (
                  <SearchableSelect
                    className="tx-row__category-select"
                    aria-label={`Categoria de ${item.description}`}
                    options={leafOptions}
                    value={item.category.id}
                    disabled={busyId === item.id}
                    onChange={(value) => {
                      void handleCategoryChange(item.id, value);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="tx-row__category linkish"
                    onClick={() => setEditingId(item.id)}
                  >
                    {item.category.name}
                  </button>
                )}
                {item.card && item.invoiceId ? (
                  <Link
                    to={`/cartoes?invoiceId=${item.invoiceId}`}
                    className="tx-row__account tx-row__account--link"
                  >
                    <CardOriginIcon className="tx-row__origin-icon" />
                    <span className="tx-row__account-label">{item.card.label}</span>
                    <span className="bank-pill">{item.card.bank.name}</span>
                  </Link>
                ) : item.card ? (
                  <span className="tx-row__account">
                    <CardOriginIcon className="tx-row__origin-icon" />
                    <span className="tx-row__account-label">{item.card.label}</span>
                    <span className="bank-pill">{item.card.bank.name}</span>
                  </span>
                ) : item.account &&
                  item.type === 'INVOICE_PAYMENT' &&
                  item.invoiceId ? (
                  <Link
                    to={`/cartoes?invoiceId=${item.invoiceId}`}
                    className="tx-row__account tx-row__account--link"
                  >
                    <AccountOriginIcon className="tx-row__origin-icon" />
                    <span className="tx-row__account-label">{item.account.label}</span>
                    <span className="bank-pill">{item.account.bank.name}</span>
                  </Link>
                ) : item.account ? (
                  <span className="tx-row__account">
                    <AccountOriginIcon className="tx-row__origin-icon" />
                    <span className="tx-row__account-label">{item.account.label}</span>
                    <span className="bank-pill">{item.account.bank.name}</span>
                  </span>
                ) : (
                  <span className="tx-row__account tx-row__account--empty">—</span>
                )}
                <span
                  className={`tx-row__amount${
                    item.amount < 0 || item.type === 'EXPENSE'
                      ? ' tx-row__amount--expense'
                      : ''
                  }`}
                >
                  {formatAmount(item.amount, item.type)}
                </span>
                <button
                  type="button"
                  className="btn btn--ghost btn--compact tx-row__action"
                  disabled={busyId === item.id}
                  onClick={() => setDeactivateId(item.id)}
                >
                  Desativar
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmModal
        open={deactivateId !== null}
        title="Desativar lançamento"
        description={
          deactivateTarget
            ? `Desativar “${deactivateTarget.description}”? O lançamento deixa de aparecer nas listagens.`
            : null
        }
        confirmLabel="Desativar"
        variant="danger"
        busy={busyId === deactivateId}
        onCancel={() => {
          if (busyId !== deactivateId) {
            setDeactivateId(null);
          }
        }}
        onConfirm={() => void runDeactivate()}
      />
    </section>
  );
}
