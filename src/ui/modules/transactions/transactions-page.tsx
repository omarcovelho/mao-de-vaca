import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/page-header';
import { RegimeToggle } from '../../components/regime-toggle';
import { listAccounts } from '../accounts/api';
import type { Origin } from '../accounts/types';
import { listCategories } from '../categories/api';
import type { Category } from '../categories/types';
import * as transactionsApi from './api';
import { formatMonthLabel, monthBounds, shiftMonth, toMonthKey } from './month';
import { useRegime } from './regime-context';
import type { TransactionItem } from './types';

const MONTH_RE = /^\d{4}-\d{2}$/;

function flattenLeaves(nodes: Category[]): Category[] {
  const leaves: Category[] = [];
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      leaves.push(...flattenLeaves(node.children));
    } else if (node.isLeaf) {
      leaves.push(node);
    }
  }
  return leaves;
}

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
  const [leaves, setLeaves] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
        setLeaves(flattenLeaves(tree));
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
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao alterar categoria',
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeactivate(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await transactionsApi.updateTransaction(id, { active: false });
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao desativar lançamento',
      );
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
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Todas</option>
              {leaves.map((leaf) => (
                <option key={leaf.id} value={leaf.id}>
                  {leaf.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Conta
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              <option value="">Todas</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
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
            const isExpense = item.type === 'EXPENSE';
            const leafOptions = leaves.filter((leaf) => {
              if (item.type === 'EXPENSE') {
                return leaf.kind === 'EXPENSE';
              }
              if (item.type === 'INCOME') {
                return leaf.kind === 'INCOME';
              }
              return true;
            });
            return (
              <li key={item.id} className="tx-row">
                <span className="tx-row__date">{formatDay(item.displayDate)}</span>
                <span className="tx-row__description" title={item.description}>
                  {item.description}
                </span>
                {editingId === item.id ? (
                  <select
                    className="tx-row__category-select"
                    aria-label={`Categoria de ${item.description}`}
                    value={item.category.id}
                    disabled={busyId === item.id}
                    onChange={(event) => {
                      void handleCategoryChange(item.id, event.target.value);
                    }}
                    onBlur={() => setEditingId(null)}
                    autoFocus
                  >
                    {leafOptions.map((leaf) => (
                      <option key={leaf.id} value={leaf.id}>
                        {leaf.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    className="tx-row__category linkish"
                    onClick={() => setEditingId(item.id)}
                  >
                    {item.category.name}
                  </button>
                )}
                {item.account ? (
                  <span className="tx-row__account">
                    <span className="tx-row__account-label">{item.account.label}</span>
                    <span className="bank-pill">{item.account.bank.name}</span>
                  </span>
                ) : (
                  <span className="tx-row__account tx-row__account--empty">—</span>
                )}
                <span
                  className={`tx-row__amount${
                    isExpense ? ' tx-row__amount--expense' : ''
                  }`}
                >
                  {formatAmount(item.amount, item.type)}
                </span>
                <button
                  type="button"
                  className="btn btn--ghost btn--compact tx-row__action"
                  disabled={busyId === item.id}
                  onClick={() => {
                    void handleDeactivate(item.id);
                  }}
                >
                  Desativar
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
