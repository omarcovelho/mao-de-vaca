import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  flattenCategoryFilterOptions,
  flattenCategoryLeaves,
  type CategoryLeafOption,
} from '../../components/category-leaves';
import { ConfirmModal } from '../../components/confirm-modal';
import { FormModal } from '../../components/form-modal';
import { MapExistingCategoryModal } from '../../components/map-existing-category-modal';
import { PageHeader } from '../../components/page-header';
import { RegimeToggle } from '../../components/regime-toggle';
import { SearchableMultiSelect } from '../../components/searchable-multi-select';
import { SearchableSelect } from '../../components/searchable-select';
import { useToast } from '../../components/toast';
import { listAccounts, listCards } from '../accounts/api';
import type { Origin } from '../accounts/types';
import { listCategories } from '../categories/api';
import { TrashGlyph } from '../categories/category-icons';
import * as transactionsApi from './api';
import { LinkTransferModal } from './link-transfer-modal';
import { TxCategoryChip } from './tx-category-chip';
import { TxOrigin } from './tx-origin';
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

function formatShortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(year, month - 1, day));
}

function initialMonth(searchParams: URLSearchParams): string {
  const fromQuery = searchParams.get('month');
  if (fromQuery && MONTH_RE.test(fromQuery)) {
    return fromQuery;
  }
  return toMonthKey();
}

type FilterDraft = {
  categoryIds: string[];
  accountId: string;
  cardId: string;
  customFrom: string;
  customTo: string;
};

export function TransactionsPage() {
  const toast = useToast();
  const { regime, setRegime } = useRegime();
  const [searchParams] = useSearchParams();
  const [month, setMonth] = useState(() => initialMonth(searchParams));
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [categoryIds, setCategoryIds] = useState<string[]>(() =>
    searchParams.getAll('categoryId').filter(Boolean),
  );
  const [accountId, setAccountId] = useState('');
  const [cardId, setCardId] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [accounts, setAccounts] = useState<Origin[]>([]);
  const [cards, setCards] = useState<Origin[]>([]);
  const [leaves, setLeaves] = useState<CategoryLeafOption[]>([]);
  const [categoryFilterOptions, setCategoryFilterOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<FilterDraft>({
    categoryIds: [],
    accountId: '',
    cardId: '',
    customFrom: '',
    customTo: '',
  });

  function changeMonth(next: string) {
    setMonth(next);
    setCustomFrom('');
    setCustomTo('');
  }

  function openFilters() {
    setDraft({
      categoryIds,
      accountId,
      cardId,
      customFrom,
      customTo,
    });
    setFiltersOpen(true);
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    if (draft.customFrom && draft.customTo && draft.customFrom > draft.customTo) {
      toast.error('A data inicial deve ser anterior ou igual à final.');
      return;
    }
    const nextAccountId = draft.accountId;
    const nextCardId = nextAccountId ? '' : draft.cardId;
    setCategoryIds(draft.categoryIds);
    setAccountId(nextAccountId);
    setCardId(nextCardId);
    setCustomFrom(draft.customFrom);
    setCustomTo(draft.customTo);
    setFiltersOpen(false);
  }

  function clearDraft() {
    setDraft({
      categoryIds: [],
      accountId: '',
      cardId: '',
      customFrom: '',
      customTo: '',
    });
  }

  useEffect(() => {
    const nextMonth = searchParams.get('month');
    if (nextMonth && MONTH_RE.test(nextMonth)) {
      setMonth(nextMonth);
      setCustomFrom('');
      setCustomTo('');
    }
    if (searchParams.has('categoryId')) {
      setCategoryIds(searchParams.getAll('categoryId').filter(Boolean));
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
        const [accountList, cardList, tree] = await Promise.all([
          listAccounts(),
          listCards(),
          listCategories(),
        ]);
        if (cancelled) {
          return;
        }
        setAccounts(accountList);
        setCards(cardList);
        setLeaves(flattenCategoryLeaves(tree));
        setCategoryFilterOptions(flattenCategoryFilterOptions(tree));
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
          categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
          accountId: accountId || undefined,
          cardId: cardId || undefined,
          q: q.trim() || undefined,
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
  }, [regime, period.from, period.to, categoryIds, accountId, cardId, q]);

  const accountFilterOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: account.label,
      })),
    [accounts],
  );

  const cardFilterOptions = useMemo(
    () =>
      cards.map((card) => ({
        value: card.id,
        label: card.label,
      })),
    [cards],
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

  function clearAdvancedFilters() {
    setCategoryIds([]);
    setAccountId('');
    setCardId('');
    setCustomFrom('');
    setCustomTo('');
  }

  function clearDraft() {
    setDraft({
      categoryIds: [],
      accountId: '',
      cardId: '',
      customFrom: '',
      customTo: '',
    });
  }

  function removeCategoryFilter(id: string) {
    setCategoryIds((current) => current.filter((item) => item !== id));
  }

  const accountLabel = useMemo(
    () => accounts.find((item) => item.id === accountId)?.label,
    [accountId, accounts],
  );

  const cardLabel = useMemo(
    () => cards.find((item) => item.id === cardId)?.label,
    [cardId, cards],
  );

  const customPeriodActive = Boolean(customFrom && customTo);

  const activeFilterCount =
    categoryIds.length +
    (accountId ? 1 : 0) +
    (cardId ? 1 : 0) +
    (customPeriodActive ? 1 : 0);

  const selectedCategoryTags = useMemo(
    () =>
      categoryIds.map((id) => ({
        id,
        label:
          categoryFilterOptions.find((option) => option.value === id)?.label ??
          id,
      })),
    [categoryFilterOptions, categoryIds],
  );

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
                onClick={() => changeMonth(shiftMonth(month, -1))}
                aria-label="Mês anterior"
              >
                ‹
              </button>
              <input
                type="month"
                className="month-nav__input"
                value={month}
                onChange={(event) => changeMonth(event.target.value)}
                aria-label="Selecionar mês"
              />
              <button
                type="button"
                className="btn btn--ghost btn--compact"
                onClick={() => changeMonth(shiftMonth(month, 1))}
                aria-label="Próximo mês"
              >
                ›
              </button>
            </div>
            <RegimeToggle value={regime} onChange={setRegime} />
          </div>
        }
      />

      <div className="tx-toolbar">
        <div className="tx-toolbar__row">
          <label className="tx-search">
            <span className="visually-hidden">Busca na descrição</span>
            <input
              type="search"
              aria-label="Busca na descrição"
              placeholder="Buscar na descrição…"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn--secondary tx-toolbar__filters-btn"
            onClick={openFilters}
          >
            Filtros
            {activeFilterCount > 0 ? (
              <span className="tx-toolbar__badge">{activeFilterCount}</span>
            ) : null}
          </button>
        </div>
        {activeFilterCount > 0 ? (
          <div className="tx-toolbar__chips">
            <ul className="filter-tags" aria-label="Filtros ativos">
              {selectedCategoryTags.map((tag) => (
                <li key={`cat-${tag.id}`}>
                  <button
                    type="button"
                    className="filter-tag"
                    onClick={() => removeCategoryFilter(tag.id)}
                    aria-label={`Remover filtro ${tag.label}`}
                  >
                    <span className="filter-tag__label" title={tag.label}>
                      {tag.label}
                    </span>
                    <span className="filter-tag__remove" aria-hidden>
                      ×
                    </span>
                  </button>
                </li>
              ))}
              {accountId && accountLabel ? (
                <li>
                  <button
                    type="button"
                    className="filter-tag"
                    onClick={() => setAccountId('')}
                    aria-label={`Remover filtro conta ${accountLabel}`}
                  >
                    <span className="filter-tag__label" title={accountLabel}>
                      Conta: {accountLabel}
                    </span>
                    <span className="filter-tag__remove" aria-hidden>
                      ×
                    </span>
                  </button>
                </li>
              ) : null}
              {cardId && cardLabel ? (
                <li>
                  <button
                    type="button"
                    className="filter-tag"
                    onClick={() => setCardId('')}
                    aria-label={`Remover filtro cartão ${cardLabel}`}
                  >
                    <span className="filter-tag__label" title={cardLabel}>
                      Cartão: {cardLabel}
                    </span>
                    <span className="filter-tag__remove" aria-hidden>
                      ×
                    </span>
                  </button>
                </li>
              ) : null}
              {customPeriodActive ? (
                <li>
                  <button
                    type="button"
                    className="filter-tag"
                    onClick={() => {
                      setCustomFrom('');
                      setCustomTo('');
                    }}
                    aria-label="Remover período personalizado"
                  >
                    <span className="filter-tag__label">
                      {formatShortDate(customFrom)} –{' '}
                      {formatShortDate(customTo)}
                    </span>
                    <span className="filter-tag__remove" aria-hidden>
                      ×
                    </span>
                  </button>
                </li>
              ) : null}
            </ul>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={clearAdvancedFilters}
            >
              Limpar filtros
            </button>
          </div>
        ) : null}
      </div>

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
                  className="tx-row__category"
                  disabled={busyId === item.id}
                  aria-label={
                    item.category
                      ? `Alterar categoria ${item.category.name}`
                      : 'Definir categoria'
                  }
                  onClick={() =>
                    setCategoryEdit({
                      id: item.id,
                      description: item.description,
                      type: item.type,
                      categoryId: item.category?.id ?? '',
                      amount: item.amount,
                    })
                  }
                >
                  <TxCategoryChip
                    category={item.category}
                    suffix={
                      item.category?.systemKey === 'ACCOUNT_TRANSFER' &&
                      !item.transferCounterpartId
                        ? 'sem vínculo'
                        : undefined
                    }
                  />
                </button>
                <TxOrigin item={item} />
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
                  className="btn btn--ghost btn--icon btn--icon-danger tx-row__action"
                  disabled={busyId === item.id}
                  aria-label={`Desativar ${item.description}`}
                  onClick={() => setDeactivateId(item.id)}
                >
                  <TrashGlyph />
                </button>
              </li>
            ))}
        </ul>
      )}

      <FormModal
        open={filtersOpen}
        title="Filtros"
        description="Refine por categoria, origem ou período personalizado. Conta e cartão são mutuamente exclusivos. O mês do cabeçalho continua valendo quando as datas custom estiverem vazias."
        wide
        onClose={() => setFiltersOpen(false)}
      >
        <form className="form-stack" onSubmit={applyFilters}>
          <label>
            Categoria
            <SearchableMultiSelect
              aria-label="Filtro de categoria"
              options={categoryFilterOptions}
              value={draft.categoryIds}
              onChange={(next) =>
                setDraft((current) => ({ ...current, categoryIds: next }))
              }
              emptyLabel="Todas"
            />
          </label>
          {draft.categoryIds.length > 0 ? (
            <ul className="filter-tags" aria-label="Categorias no rascunho">
              {draft.categoryIds.map((id) => {
                const label =
                  categoryFilterOptions.find((option) => option.value === id)
                    ?.label ?? id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className="filter-tag"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          categoryIds: current.categoryIds.filter(
                            (item) => item !== id,
                          ),
                        }))
                      }
                      aria-label={`Remover ${label}`}
                    >
                      <span className="filter-tag__label" title={label}>
                        {label}
                      </span>
                      <span className="filter-tag__remove" aria-hidden>
                        ×
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <div className="filters-modal__grid">
            <label>
              Conta
              <SearchableSelect
                aria-label="Filtro de conta"
                options={accountFilterOptions}
                value={draft.accountId}
                onChange={(next) =>
                  setDraft((current) => ({
                    ...current,
                    accountId: next,
                    cardId: next ? '' : current.cardId,
                  }))
                }
                allowEmpty
                emptyLabel="Todas"
              />
            </label>
            <label>
              Cartão
              <SearchableSelect
                aria-label="Filtro de cartão"
                options={cardFilterOptions}
                value={draft.cardId}
                onChange={(next) =>
                  setDraft((current) => ({
                    ...current,
                    cardId: next,
                    accountId: next ? '' : current.accountId,
                  }))
                }
                allowEmpty
                emptyLabel="Todos"
              />
            </label>
            <label>
              Data de
              <input
                type="date"
                value={draft.customFrom}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    customFrom: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Data até
              <input
                type="date"
                value={draft.customTo}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    customTo: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={clearDraft}
            >
              Limpar
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setFiltersOpen(false)}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary">
              Aplicar
            </button>
          </div>
        </form>
      </FormModal>

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
