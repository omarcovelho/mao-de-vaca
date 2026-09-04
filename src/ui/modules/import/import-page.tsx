import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { flattenCategoryLeaves, flattenCategoryParents, findCategoryLabel } from '../../components/category-leaves';
import type { CategoryLeafOption, CategoryNodeOption } from '../../components/category-leaves';
import { ConfirmModal } from '../../components/confirm-modal';
import { CreateImportCategoryModal } from '../../components/create-import-category-modal';
import { MapExistingCategoryModal } from '../../components/map-existing-category-modal';
import { PageHeader } from '../../components/page-header';
import { SearchableSelect } from '../../components/searchable-select';
import { useToast } from '../../components/toast';
import { listCategories } from '../categories/api';
import type { Category } from '../categories/types';
import * as importApi from './api';
import type {
  CategoryMappingValue,
  ConfirmResponse,
  ImportHistoryItem,
  ImportModeId,
  ImportOptions,
  PreviewResponse,
  PreviewRow,
} from './types';

const TYPE_LABELS = {
  EXPENSE: 'Despesa',
  INCOME: 'Receita',
  TRANSFER: 'Transferência',
  INVOICE_PAYMENT: 'Pagamento de fatura',
} as const;

const WARNING_LABELS = {
  existing: 'Já importado',
  within_file: 'Possível duplicata no arquivo',
} as const;

type MappingDraft = {
  mode: 'pending' | 'existing' | 'create';
  categoryId: string;
  name: string;
  parentId: string;
  createConfigured: boolean;
};

function mappingsReady(
  unknown: string[],
  drafts: Record<string, MappingDraft>,
): boolean {
  return unknown.every((name) => {
    const draft = drafts[name];
    if (!draft || draft.mode === 'pending') {
      return false;
    }
    if (draft.mode === 'existing') {
      return Boolean(draft.categoryId);
    }
    return draft.createConfigured && Boolean(draft.name.trim());
  });
}

function toCategoryMappings(
  unknown: string[],
  drafts: Record<string, MappingDraft>,
): Record<string, CategoryMappingValue> {
  const mappings: Record<string, CategoryMappingValue> = {};
  for (const name of unknown) {
    const draft = drafts[name];
    if (!draft || draft.mode === 'pending') {
      continue;
    }
    if (draft.mode === 'existing') {
      mappings[name] = draft.categoryId;
      continue;
    }
    mappings[name] = {
      create: {
        name: draft.name.trim(),
        ...(draft.parentId ? { parentId: draft.parentId } : {}),
      },
    };
  }
  return mappings;
}

function emptyPendingDraft(name: string): MappingDraft {
  return {
    mode: 'pending',
    categoryId: '',
    name,
    parentId: '',
    createConfigured: false,
  };
}

function formatMonth(isoDate: string): string {
  const [year, month] = isoDate.slice(0, 7).split('-');
  return `${month}/${year}`;
}

function defaultSelectedLines(rows: PreviewRow[]): Set<number> {
  const selected = new Set<number>();
  for (const row of rows) {
    if (row.error) {
      continue;
    }
    if (row.duplicateWarning === 'existing') {
      continue;
    }
    selected.add(row.line);
  }
  return selected;
}

function validPreviewRows(rows: PreviewRow[]): PreviewRow[] {
  return rows.filter((row) => !row.error);
}

function formatHistoryOrigin(item: ImportHistoryItem): string {
  const origin =
    item.importMode === 'invoice'
      ? (item.cardLabel ?? 'Cartão')
      : (item.accountLabel ?? 'Conta');
  if (item.bankName) {
    return `${item.bankName} · ${origin}`;
  }
  return origin;
}

function formatResultSummary(result: ConfirmResponse): string {
  const parts = [
    `${result.created} criados`,
    `${result.skipped} ignorados`,
  ];
  if (typeof result.deselected === 'number') {
    parts.push(`${result.deselected} desmarcados`);
  }
  if (result.errors.length > 0) {
    parts.push(`${result.errors.length} erros`);
  }
  return parts.join(', ') + '.';
}

export function ImportPage() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [options, setOptions] = useState<ImportOptions | null>(null);
  const [history, setHistory] = useState<ImportHistoryItem[]>([]);
  const [leaves, setLeaves] = useState<CategoryLeafOption[]>([]);
  const [parentOptions, setParentOptions] = useState<CategoryNodeOption[]>([]);
  const [importMode, setImportMode] = useState<ImportModeId>('transactions');
  const [accountId, setAccountId] = useState('');
  const [cardId, setCardId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [parserId, setParserId] = useState('standard');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'preview' | 'confirm' | 'delete' | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, MappingDraft>>({});
  const [result, setResult] = useState<ConfirmResponse | null>(null);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ImportHistoryItem | null>(
    null,
  );
  const [createModalName, setCreateModalName] = useState<string | null>(null);
  const [createModalParentId, setCreateModalParentId] = useState('');
  const [existingModalName, setExistingModalName] = useState<string | null>(
    null,
  );
  const [existingModalCategoryId, setExistingModalCategoryId] = useState('');

  function applyCategoryTree(tree: Category[]) {
    setLeaves(flattenCategoryLeaves(tree));
    setParentOptions(flattenCategoryParents(tree));
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [nextOptions, nextHistory, tree] = await Promise.all([
          importApi.getImportOptions(),
          importApi.listImportHistory(),
          listCategories(),
        ]);
        if (cancelled) {
          return;
        }
        setOptions(nextOptions);
        setHistory(nextHistory);
        applyCategoryTree(tree);
        setParserId(nextOptions.parsers[0]?.id ?? 'standard');
        setAccountId((current) => current || nextOptions.accounts[0]?.id || '');
        const cards = nextOptions.cards ?? [];
        const invoicesByCard = nextOptions.invoicesByCard ?? {};
        const firstCardId = cards[0]?.id ?? '';
        setCardId((current) => current || firstCardId);
        const firstInvoices = firstCardId
          ? (invoicesByCard[firstCardId] ?? [])
          : [];
        setInvoiceId((current) => current || firstInvoices[0]?.id || '');
      } catch {
        if (!cancelled) {
          setError('Não foi possível carregar a importação.');
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
  }, []);

  const cardInvoices = useMemo(() => {
    if (!options || !cardId) {
      return [];
    }
    return (options.invoicesByCard ?? {})[cardId] ?? [];
  }, [options, cardId]);

  useEffect(() => {
    if (cardInvoices.length === 0) {
      setInvoiceId('');
      return;
    }
    setInvoiceId((current) =>
      cardInvoices.some((invoice) => invoice.id === current)
        ? current
        : cardInvoices[0].id,
    );
  }, [cardInvoices]);

  const selectedCount = selectedLines.size;

  const unknownForSelected = useMemo(() => {
    if (!preview) {
      return [];
    }
    return preview.unknownCategories.filter((name) =>
      preview.rows.some(
        (row) =>
          selectedLines.has(row.line) &&
          !row.error &&
          (row.category ?? '') === name,
      ),
    );
  }, [preview, selectedLines]);

  const canConfirm = useMemo(() => {
    if (!preview || !file || selectedCount === 0) {
      return false;
    }
    return mappingsReady(unknownForSelected, drafts);
  }, [preview, file, drafts, selectedCount, unknownForSelected]);

  const originReady =
    importMode === 'transactions'
      ? Boolean(accountId)
      : Boolean(cardId && invoiceId);

  const accountOptions = useMemo(
    () =>
      (options?.accounts ?? []).map((account) => ({
        value: account.id,
        label: `${account.label} · ${account.bank.name}`,
      })),
    [options],
  );

  const cardOptions = useMemo(
    () =>
      (options?.cards ?? []).map((card) => ({
        value: card.id,
        label: `${card.label} · ${card.bank.name}`,
      })),
    [options],
  );

  const invoiceOptions = useMemo(
    () =>
      cardInvoices.map((invoice) => ({
        value: invoice.id,
        label: `${formatMonth(invoice.referenceMonth)} · vence ${invoice.dueDate}`,
      })),
    [cardInvoices],
  );

  const parserOptions = useMemo(
    () =>
      (options?.parsers ?? []).map((parser) => ({
        value: parser.id,
        label: parser.label,
      })),
    [options],
  );

  const leafOptions = useMemo(
    () => leaves.map((leaf) => ({ value: leaf.value, label: leaf.label })),
    [leaves],
  );

  function clearWorkingState() {
    setFile(null);
    setPreview(null);
    setSelectedLines(new Set());
    setDrafts({});
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleFile(next: File | null) {
    setFile(next);
    setPreview(null);
    setSelectedLines(new Set());
    setDrafts({});
    setError(null);
  }

  function switchMode(mode: ImportModeId) {
    setImportMode(mode);
    handleFile(null);
    setResult(null);
  }

  function toggleLine(line: number) {
    setSelectedLines((current) => {
      const next = new Set(current);
      if (next.has(line)) {
        next.delete(line);
      } else {
        next.add(line);
      }
      return next;
    });
  }

  function selectAllValid() {
    if (!preview) {
      return;
    }
    setSelectedLines(
      new Set(validPreviewRows(preview.rows).map((row) => row.line)),
    );
  }

  function deselectAll() {
    setSelectedLines(new Set());
  }

  function deselectDuplicateWarnings() {
    if (!preview) {
      return;
    }
    setSelectedLines((current) => {
      const next = new Set(current);
      for (const row of preview.rows) {
        if (row.duplicateWarning) {
          next.delete(row.line);
        }
      }
      return next;
    });
  }

  async function handlePreview(event: FormEvent) {
    event.preventDefault();
    if (!file || !originReady) {
      return;
    }
    setBusy('preview');
    setError(null);
    setResult(null);
    const form = new FormData();
    form.set('importMode', importMode);
    form.set('parserId', parserId);
    form.set('file', file);
    if (importMode === 'transactions') {
      form.set('accountId', accountId);
    } else {
      form.set('cardId', cardId);
      form.set('invoiceId', invoiceId);
    }
    try {
      const next = await importApi.previewImport(form);
      setPreview(next);
      setSelectedLines(defaultSelectedLines(next.rows));
      setDrafts(
        Object.fromEntries(
          next.unknownCategories.map((name) => [name, emptyPendingDraft(name)]),
        ),
      );
    } catch {
      const message = 'Não foi possível pré-visualizar o arquivo.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  async function runConfirmImport() {
    if (!file || !preview || !canConfirm) {
      return;
    }
    setBusy('confirm');
    setError(null);
    const form = new FormData();
    form.set('importMode', importMode);
    form.set('parserId', parserId);
    form.set(
      'categoryMappings',
      JSON.stringify(toCategoryMappings(unknownForSelected, drafts)),
    );
    form.set(
      'selectedLines',
      JSON.stringify([...selectedLines].sort((a, b) => a - b)),
    );
    form.set('file', file);
    if (importMode === 'transactions') {
      form.set('accountId', accountId);
    } else {
      form.set('cardId', cardId);
      form.set('invoiceId', invoiceId);
    }
    try {
      const next = await importApi.confirmImport(form);
      setResult(next);
      setHistory(await importApi.listImportHistory());
      setOptions(await importApi.getImportOptions());
      applyCategoryTree(await listCategories());
      clearWorkingState();
      setConfirmImportOpen(false);
      toast.success(`Importação concluída: ${formatResultSummary(next)}`);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Não foi possível confirmar a importação.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  async function runDeleteBatch() {
    if (!deleteTarget) {
      return;
    }
    setBusy('delete');
    setError(null);
    try {
      await importApi.deleteImport(deleteTarget.id);
      setHistory(await importApi.listImportHistory());
      setResult(null);
      setDeleteTarget(null);
      toast.success('Importação excluída.');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Não foi possível excluir a importação.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <section className="page">
        <p className="page__empty">Carregando…</p>
      </section>
    );
  }

  const hasAccounts = (options?.accounts.length ?? 0) > 0;
  const hasCards = (options?.cards?.length ?? 0) > 0;

  if (!hasAccounts && !hasCards) {
    return (
      <section className="page">
        <PageHeader
          title="Importar"
          subtitle="Envie um CSV do seu banco ou cartão"
        />
        <p className="page__empty">
          Cadastre uma conta ou cartão para importar.{' '}
          <Link to="/contas">Ir para contas</Link>
        </p>
      </section>
    );
  }

  const warningCount = preview?.summary.duplicateWarningCount ?? 0;

  return (
    <section className="page">
      <PageHeader
        title="Importar"
        subtitle="Envie um CSV do seu banco ou cartão"
      />

      {result ? (
        <div className="import-result" role="status">
          <p className="status-pill status-pill--success">
            {formatResultSummary(result)}
          </p>
          <Link to="/lancamentos" className="btn btn--secondary btn--compact">
            Ver lançamentos
          </Link>
          {result.errors.length > 0 ? (
            <ul className="import-result__errors">
              {result.errors.map((item) => (
                <li key={`${item.line}-${item.message}`}>
                  Linha {item.line}: {item.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <form
        className="form-panel import-form"
        onSubmit={(e) => void handlePreview(e)}
      >
        <div className="form-stack">
          <span className="form-label">Tipo</span>
          <div className="pill-group" role="group" aria-label="Tipo de importação">
            <button
              type="button"
              className={`pill${importMode === 'transactions' ? ' pill--active' : ''}`}
              onClick={() => switchMode('transactions')}
              disabled={!hasAccounts}
            >
              Extrato de conta
            </button>
            <button
              type="button"
              className={`pill${importMode === 'invoice' ? ' pill--active' : ''}`}
              onClick={() => switchMode('invoice')}
              disabled={!hasCards}
            >
              Fatura de cartão
            </button>
          </div>
          {importMode === 'invoice' ? (
            <p className="form-hint">
              Remova as linhas de pagamento do CSV antes de importar. Importe
              apenas gastos e estornos.
            </p>
          ) : null}
        </div>

        {importMode === 'transactions' ? (
          <div className="form-stack">
            <label id="import-account-label" htmlFor="import-account">
              Origem
            </label>
            {hasAccounts ? (
              <SearchableSelect
                id="import-account"
                aria-label="Origem"
                options={accountOptions}
                value={accountId}
                onChange={setAccountId}
              />
            ) : (
              <p className="form-hint">
                Nenhuma conta ativa.{' '}
                <Link to="/contas">Cadastrar conta</Link>
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="form-stack">
              <label htmlFor="import-card">Cartão</label>
              <SearchableSelect
                id="import-card"
                aria-label="Cartão"
                options={cardOptions}
                value={cardId}
                onChange={setCardId}
              />
            </div>
            <div className="form-stack">
              <label htmlFor="import-invoice">Fatura</label>
              {cardInvoices.length === 0 ? (
                <p className="form-hint">
                  Nenhuma fatura neste cartão.{' '}
                  <Link to="/cartoes">Criar fatura</Link>
                </p>
              ) : (
                <SearchableSelect
                  id="import-invoice"
                  aria-label="Fatura"
                  options={invoiceOptions}
                  value={invoiceId}
                  onChange={setInvoiceId}
                />
              )}
            </div>
          </>
        )}

        <div className="form-stack">
          <label htmlFor="import-parser">Parser</label>
          <SearchableSelect
            id="import-parser"
            aria-label="Parser"
            options={parserOptions}
            value={parserId}
            onChange={setParserId}
          />
        </div>

        <div className="form-stack">
          <span className="form-label">Arquivo</span>
          <button
            type="button"
            className="import-dropzone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleFile(event.dataTransfer.files[0] ?? null);
            }}
          >
            <strong>{file ? file.name : 'Arraste o CSV aqui'}</strong>
            <span>ou clique para escolher o arquivo</span>
          </button>
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
          />
        </div>

        {error ? (
          <p className="form-stack" role="alert">
            {error}
          </p>
        ) : null}

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn--primary"
            disabled={!file || !originReady || busy !== null}
          >
            {busy === 'preview' ? 'Pré-visualizando…' : 'Pré-visualizar'}
          </button>
        </div>
      </form>

      {preview ? (
        <section className="section" aria-labelledby="preview-heading">
          <div className="section__header">
            <h2 id="preview-heading" className="section__title">
              Pré-visualização
            </h2>
          </div>
          <p className="form-hint">
            {preview.summary.validCount} linhas válidas,{' '}
            {preview.summary.errorCount} erros,{' '}
            {preview.summary.unknownCategoryCount} categorias desconhecidas
            {warningCount > 0 ? `, ${warningCount} avisos de duplicação` : ''}.{' '}
            {selectedCount} selecionadas para importar.
          </p>
          <div
            className="import-preview-actions"
            role="group"
            aria-label="Seleção de linhas"
          >
            <button
              type="button"
              className="btn btn--secondary btn--compact"
              onClick={selectAllValid}
            >
              Selecionar todas
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--compact"
              onClick={deselectAll}
            >
              Desmarcar todas
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--compact"
              onClick={deselectDuplicateWarnings}
              disabled={warningCount === 0}
            >
              Desmarcar avisos de duplicação
            </button>
          </div>
          <ul className="import-preview-list">
            {preview.rows.map((row) => (
              <li
                key={row.line}
                className={`import-preview-row${
                  row.duplicateWarning ? ' import-preview-row--warning' : ''
                }`}
              >
                {row.error ? (
                  <span>
                    Linha {row.line}: {row.error}
                  </span>
                ) : (
                  <>
                    <label className="import-preview-row__select">
                      <input
                        type="checkbox"
                        checked={selectedLines.has(row.line)}
                        onChange={() => toggleLine(row.line)}
                        aria-label={`Importar linha ${row.line}: ${row.description ?? ''}`}
                      />
                      <span className="import-preview-row__text">
                        {row.description}
                        <span className="import-preview-row__meta">
                          {' '}
                          · {row.category} · {row.competenceDate} ·{' '}
                          {row.type ? TYPE_LABELS[row.type] : ''}
                        </span>
                        {row.duplicateWarning ? (
                          <span className="import-preview-row__warning">
                            {' '}
                            · {WARNING_LABELS[row.duplicateWarning]}
                          </span>
                        ) : null}
                      </span>
                    </label>
                    <span
                      className={
                        row.amount?.startsWith('-')
                          ? 'import-preview-row__amount import-preview-row__amount--expense'
                          : 'import-preview-row__amount'
                      }
                    >
                      {row.amount}
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>

          {preview.unknownCategories.length > 0 ? (
            <div className="form-stack">
              <h3 className="section__title">Categorias desconhecidas</h3>
              {preview.unknownCategories.map((name) => {
                const draft = drafts[name];
                const displayName = name || '(sem categoria)';
                const relatedRows = preview.rows.filter(
                  (row) => !row.error && (row.category ?? '') === name,
                );
                return (
                  <section
                    key={name}
                    className="import-mapping"
                    aria-labelledby={`unknown-cat-${name || 'empty'}`}
                  >
                    <div className="import-mapping__header">
                      <p
                        id={`unknown-cat-${name || 'empty'}`}
                        className="import-mapping__status"
                        role="status"
                      >
                        Categoria não encontrada:{' '}
                        <strong>{displayName}</strong>
                      </p>
                      <div
                        className="pill-group"
                        role="group"
                        aria-label={`Resolver ${displayName}`}
                      >
                        <button
                          type="button"
                          className={`pill${
                            draft?.mode === 'create' && draft.createConfigured
                              ? ' pill--active'
                              : ''
                          }`}
                          onClick={() => {
                            setDrafts((current) => ({
                              ...current,
                              [name]: {
                                ...(current[name] ?? emptyPendingDraft(name)),
                                mode: 'create',
                                categoryId: '',
                                name,
                              },
                            }));
                            setCreateModalParentId(
                              drafts[name]?.parentId ?? '',
                            );
                            setCreateModalName(name);
                          }}
                        >
                          Criar
                        </button>
                        <button
                          type="button"
                          className={`pill${
                            draft?.mode === 'existing' && draft.categoryId
                              ? ' pill--active'
                              : ''
                          }`}
                          onClick={() => {
                            setExistingModalCategoryId(
                              drafts[name]?.mode === 'existing'
                                ? (drafts[name]?.categoryId ?? '')
                                : '',
                            );
                            setExistingModalName(name);
                          }}
                        >
                          Usar atual
                        </button>
                      </div>
                    </div>

                    {relatedRows.length > 0 ? (
                      <ul className="import-mapping__rows">
                        {relatedRows.map((row) => (
                          <li key={row.line} className="import-mapping__row">
                            <span className="import-mapping__row-desc">
                              {row.description}
                              <span className="import-mapping__row-meta">
                                {' '}
                                · {row.competenceDate}
                                {row.type ? ` · ${TYPE_LABELS[row.type]}` : ''}
                              </span>
                            </span>
                            <span
                              className={
                                row.amount?.startsWith('-')
                                  ? 'import-mapping__row-amount import-mapping__row-amount--expense'
                                  : 'import-mapping__row-amount'
                              }
                            >
                              {row.amount}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {draft?.mode === 'existing' && draft.categoryId ? (
                      <div className="import-mapping__create">
                        <p className="form-hint">
                          Usar “
                          {findCategoryLabel(leafOptions, draft.categoryId) ??
                            'categoria selecionada'}
                          ” para “{displayName}”
                        </p>
                        <button
                          type="button"
                          className="btn btn--secondary btn--compact"
                          onClick={() => {
                            setExistingModalCategoryId(draft.categoryId);
                            setExistingModalName(name);
                          }}
                        >
                          Alterar
                        </button>
                      </div>
                    ) : null}

                    {draft?.mode === 'create' && draft.createConfigured ? (
                      <div className="import-mapping__create">
                        <p className="form-hint">
                          {draft.parentId
                            ? `Criar “${displayName}” em ${findCategoryLabel(parentOptions, draft.parentId) ?? 'categoria selecionada'}`
                            : `Criar “${displayName}” como categoria raiz`}
                        </p>
                        <button
                          type="button"
                          className="btn btn--secondary btn--compact"
                          onClick={() => {
                            setCreateModalParentId(draft.parentId);
                            setCreateModalName(name);
                          }}
                        >
                          Alterar
                        </button>
                      </div>
                    ) : null}

                    {draft?.mode === 'create' && !draft.createConfigured ? (
                      <p className="form-hint">
                        Confirme a criação no modal para continuar.
                      </p>
                    ) : null}
                  </section>
                );
              })}
            </div>
          ) : null}

          <div className="form-actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canConfirm || busy !== null}
              onClick={() => setConfirmImportOpen(true)}
            >
              {busy === 'confirm' ? 'Confirmando…' : 'Confirmar importação'}
            </button>
            {selectedCount === 0 ? (
              <p className="form-hint">
                Selecione ao menos uma linha para importar.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="section" aria-labelledby="history-heading">
        <div className="section__header">
          <h2 id="history-heading" className="section__title">
            Histórico
          </h2>
        </div>
        {history.length === 0 ? (
          <p className="page__empty">Nenhuma importação ainda.</p>
        ) : (
          <ul className="import-history">
            {history.map((item) => (
              <li key={item.id} className="import-history__item">
                <div className="import-history__meta">
                  <strong>{item.fileName}</strong>
                  <span>
                    {formatHistoryOrigin(item)} · {item.createdCount}{' '}
                    criados, {item.skippedCount} ignorados
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost btn--icon import-history__delete"
                  disabled={busy !== null}
                  aria-label={`Excluir importação ${item.fileName}`}
                  title="Excluir"
                  onClick={() => setDeleteTarget(item)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="1.1em"
                    height="1.1em"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M4 7h16" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
                    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CreateImportCategoryModal
        open={createModalName !== null}
        categoryName={
          createModalName === null
            ? ''
            : createModalName || '(sem categoria)'
        }
        parentId={createModalParentId}
        parentOptions={parentOptions.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
        onParentIdChange={setCreateModalParentId}
        onCancel={() => setCreateModalName(null)}
        onConfirm={() => {
          if (createModalName === null) {
            return;
          }
          const csvName = createModalName;
          setDrafts((current) => ({
            ...current,
            [csvName]: {
              mode: 'create',
              categoryId: '',
              name: csvName,
              parentId: createModalParentId,
              createConfigured: true,
            },
          }));
          setCreateModalName(null);
        }}
      />

      <MapExistingCategoryModal
        open={existingModalName !== null}
        categoryName={
          existingModalName === null
            ? ''
            : existingModalName || '(sem categoria)'
        }
        categoryId={existingModalCategoryId}
        options={leafOptions}
        onCategoryIdChange={setExistingModalCategoryId}
        onCancel={() => setExistingModalName(null)}
        onConfirm={() => {
          if (existingModalName === null || !existingModalCategoryId) {
            return;
          }
          const csvName = existingModalName;
          setDrafts((current) => ({
            ...current,
            [csvName]: {
              mode: 'existing',
              categoryId: existingModalCategoryId,
              name: csvName,
              parentId: '',
              createConfigured: false,
            },
          }));
          setExistingModalName(null);
        }}
      />

      <ConfirmModal
        open={confirmImportOpen}
        title="Confirmar importação"
        description={`Importar ${selectedCount} linha(s) selecionada(s)? Esta ação cria lançamentos no sistema.`}
        confirmLabel="Importar"
        busy={busy === 'confirm'}
        onCancel={() => {
          if (busy !== 'confirm') {
            setConfirmImportOpen(false);
          }
        }}
        onConfirm={() => void runConfirmImport()}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        title="Excluir importação"
        description={
          deleteTarget
            ? `Excluir permanentemente ${deleteTarget.createdCount} lançamento(s) de “${deleteTarget.fileName}”? A fatura (se houver) não será removida.`
            : null
        }
        confirmLabel="Excluir"
        variant="danger"
        busy={busy === 'delete'}
        onCancel={() => {
          if (busy !== 'delete') {
            setDeleteTarget(null);
          }
        }}
        onConfirm={() => void runDeleteBatch()}
      />
    </section>
  );
}
