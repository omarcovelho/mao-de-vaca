import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  flattenCategoryLeaves,
  type CategoryLeafOption,
} from '../../components/category-leaves';
import { ConfirmModal } from '../../components/confirm-modal';
import { MapExistingCategoryModal } from '../../components/map-existing-category-modal';
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
import { LinkTransferModal } from './link-transfer-modal';
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
  const [categoryEdit, setCategoryEdit] = useState<{
    id: string;
    description: string;
    type: TransactionItem['type'];
    categoryId: string;
    amount: number;
  } | null>(null);
  const [transferLink, setTransferLink] = useState<{
    source: TransactionItem;
    categoryId: string;
  } | null>(null);
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

  async function handleCategoryChange(
    id: string,
    nextCategoryId: string,
    counterpartTransactionId?: string,
  ) {
    setBusyId(id);
    setError(null);
    const previousCounterpartId =
      items.find((item) => item.id === id)?.transferCounterpartId ?? null;
    try {
      const updated = await transactionsApi.updateTransaction(id, {
        categoryId: nextCategoryId,
        counterpartTransactionId,
      });
      setItems((current) =>
        current.map((item) => {
          if (item.id === id) {
            return updated;
          }
          if (
            updated.transferCounterpartId &&
            item.id === updated.transferCounterpartId
          ) {
            return {
              ...item,
              type: 'TRANSFER' as const,
              category: updated.category,
              transferCounterpartId: updated.id,
            };
          }
          if (
            !updated.transferCounterpartId &&
            previousCounterpartId &&
            item.id === previousCounterpartId
          ) {
            const counterpartType =
              updated.type === 'TRANSFER'
                ? ('TRANSFER' as const)
                : item.amount < 0
                  ? ('EXPENSE' as const)
                  : ('INCOME' as const);
            return {
              ...item,
              type: counterpartType,
              category: updated.category,
              transferCounterpartId: null,
            };
          }
          return item;
        }),
      );
      setCategoryEdit(null);
      setTransferLink(null);
      toast.success(
        counterpartTransactionId
          ? 'Transferência vinculada.'
          : 'Categoria atualizada.',
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Falha ao alterar categoria';
      setError(message);
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  }

  function onConfirmCategoryEdit() {
    if (!categoryEdit?.categoryId) {
      return;
    }
    const leaf = leaves.find((item) => item.value === categoryEdit.categoryId);
    if (leaf?.systemKey === 'INVOICE_PAYMENT') {
      toast.error(
        'Pagamento de fatura só pode ser classificado ao vincular na fatura.',
      );
      return;
    }
    if (leaf?.systemKey === 'ACCOUNT_TRANSFER') {
      const source = items.find((item) => item.id === categoryEdit.id);
      if (!source) {
        return;
      }
      setTransferLink({
        source,
        categoryId: categoryEdit.categoryId,
      });
      setCategoryEdit(null);
      return;
    }
    void handleCategoryChange(categoryEdit.id, categoryEdit.categoryId);
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

  const categoryEditOptions = useMemo(() => {
    if (!categoryEdit) {
      return [];
    }
    return leaves
      .filter((leaf) => {
        if (leaf.systemKey === 'INVOICE_PAYMENT') {
          return false;
        }
        if (leaf.kind === 'NON_EXPENSE') {
          return true;
        }
        if (categoryEdit.type === 'EXPENSE' || categoryEdit.type === 'TRANSFER') {
          return leaf.kind === 'EXPENSE' || leaf.kind === 'NON_EXPENSE';
        }
        if (categoryEdit.type === 'INCOME') {
          return leaf.kind === 'INCOME' || leaf.kind === 'NON_EXPENSE';
        }
        return leaf.kind !== 'NON_EXPENSE' || Boolean(leaf.systemKey);
      })
      .map((leaf) => ({ value: leaf.value, label: leaf.label }));
  }, [categoryEdit, leaves]);

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
          {items.map((item) => (
              <li key={item.id} className="tx-row">
                <span className="tx-row__date">{formatDay(item.displayDate)}</span>
                <span className="tx-row__description" title={item.description}>
                  {item.description}
                </span>
                <button
                  type="button"
                  className="tx-row__category linkish"
                  disabled={busyId === item.id}
                  onClick={() =>
                    setCategoryEdit({
                      id: item.id,
                      description: item.description,
                      type: item.type,
                      categoryId: item.category.id,
                      amount: item.amount,
                    })
                  }
                >
                  {item.category.name}
                  {item.category.systemKey === 'ACCOUNT_TRANSFER' &&
                  !item.transferCounterpartId
                    ? ' · sem vínculo'
                    : ''}
                </button>
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
            ))}
        </ul>
      )}

      <MapExistingCategoryModal
        open={categoryEdit !== null}
        title="Alterar categoria"
        description={
          categoryEdit ? (
            <p className="form-hint" style={{ margin: 0 }}>
              Escolha a categoria de <strong>{categoryEdit.description}</strong>.
            </p>
          ) : null
        }
        categoryId={categoryEdit?.categoryId ?? ''}
        options={categoryEditOptions}
        confirmLabel="Salvar"
        busy={busyId === categoryEdit?.id}
        onCategoryIdChange={(nextCategoryId) => {
          setCategoryEdit((current) =>
            current ? { ...current, categoryId: nextCategoryId } : current,
          );
        }}
        onCancel={() => {
          if (busyId !== categoryEdit?.id) {
            setCategoryEdit(null);
          }
        }}
        onConfirm={() => {
          onConfirmCategoryEdit();
        }}
      />

      <LinkTransferModal
        open={transferLink !== null}
        source={transferLink?.source ?? null}
        categoryId={transferLink?.categoryId ?? ''}
        busy={busyId === transferLink?.source.id}
        onCancel={() => {
          if (busyId !== transferLink?.source.id) {
            setTransferLink(null);
          }
        }}
        onConfirm={(counterpartId) => {
          if (!transferLink) {
            return;
          }
          void handleCategoryChange(
            transferLink.source.id,
            transferLink.categoryId,
            counterpartId,
          );
        }}
      />

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
