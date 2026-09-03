import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/page-header';
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
} from './types';

const TYPE_LABELS = {
  EXPENSE: 'Despesa',
  INCOME: 'Receita',
  TRANSFER: 'Transferência',
} as const;

type MappingDraft = {
  mode: 'existing' | 'create';
  categoryId: string;
  name: string;
};

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

function mappingsReady(
  unknown: string[],
  drafts: Record<string, MappingDraft>,
): boolean {
  return unknown.every((name) => {
    const draft = drafts[name];
    if (!draft) {
      return false;
    }
    if (draft.mode === 'existing') {
      return Boolean(draft.categoryId);
    }
    return Boolean(draft.name.trim());
  });
}

function toCategoryMappings(
  unknown: string[],
  drafts: Record<string, MappingDraft>,
): Record<string, CategoryMappingValue> {
  const mappings: Record<string, CategoryMappingValue> = {};
  for (const name of unknown) {
    const draft = drafts[name];
    if (!draft) {
      continue;
    }
    mappings[name] =
      draft.mode === 'existing'
        ? draft.categoryId
        : { create: { name: draft.name.trim() } };
  }
  return mappings;
}

function formatMonth(isoDate: string): string {
  const [year, month] = isoDate.slice(0, 7).split('-');
  return `${month}/${year}`;
}

export function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [options, setOptions] = useState<ImportOptions | null>(null);
  const [history, setHistory] = useState<ImportHistoryItem[]>([]);
  const [leaves, setLeaves] = useState<Category[]>([]);
  const [importMode, setImportMode] = useState<ImportModeId>('transactions');
  const [accountId, setAccountId] = useState('');
  const [cardId, setCardId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [parserId, setParserId] = useState('standard');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'preview' | 'confirm' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<string, MappingDraft>>({});
  const [result, setResult] = useState<ConfirmResponse | null>(null);

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
        setLeaves(flattenLeaves(tree));
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

  const canConfirm = useMemo(() => {
    if (!preview || !file) {
      return false;
    }
    return mappingsReady(preview.unknownCategories, drafts);
  }, [preview, file, drafts]);

  const originReady =
    importMode === 'transactions' ? Boolean(accountId) : Boolean(cardId && invoiceId);

  function handleFile(next: File | null) {
    setFile(next);
    setPreview(null);
    setResult(null);
    setDrafts({});
    setError(null);
  }

  function switchMode(mode: ImportModeId) {
    setImportMode(mode);
    handleFile(null);
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
      setDrafts(
        Object.fromEntries(
          next.unknownCategories.map((name) => [
            name,
            { mode: 'create' as const, categoryId: '', name },
          ]),
        ),
      );
    } catch {
      setError('Não foi possível pré-visualizar o arquivo.');
    } finally {
      setBusy(null);
    }
  }

  async function handleConfirm() {
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
      JSON.stringify(toCategoryMappings(preview.unknownCategories, drafts)),
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
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível confirmar a importação.',
      );
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

  return (
    <section className="page">
      <PageHeader
        title="Importar"
        subtitle="Envie um CSV do seu banco ou cartão"
      />

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
            <label htmlFor="import-account">Origem</label>
            {hasAccounts ? (
              <select
                id="import-account"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              >
                {options?.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label} · {account.bank.name}
                  </option>
                ))}
              </select>
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
              <select
                id="import-card"
                value={cardId}
                onChange={(event) => setCardId(event.target.value)}
              >
                {options?.cards?.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.label} · {card.bank.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-stack">
              <label htmlFor="import-invoice">Fatura</label>
              {cardInvoices.length === 0 ? (
                <p className="form-hint">
                  Nenhuma fatura neste cartão.{' '}
                  <Link to="/cartoes">Criar fatura</Link>
                </p>
              ) : (
                <select
                  id="import-invoice"
                  value={invoiceId}
                  onChange={(event) => setInvoiceId(event.target.value)}
                >
                  {cardInvoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {formatMonth(invoice.referenceMonth)} · vence{' '}
                      {invoice.dueDate}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </>
        )}

        <div className="form-stack">
          <label htmlFor="import-parser">Parser</label>
          <select
            id="import-parser"
            value={parserId}
            onChange={(event) => setParserId(event.target.value)}
          >
            {options?.parsers.map((parser) => (
              <option key={parser.id} value={parser.id}>
                {parser.label}
              </option>
            ))}
          </select>
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
            {preview.summary.unknownCategoryCount} categorias desconhecidas.
          </p>
          <ul className="import-preview-list">
            {preview.rows.map((row) => (
              <li key={row.line} className="import-preview-row">
                {row.error ? (
                  <span>
                    Linha {row.line}: {row.error}
                  </span>
                ) : (
                  <>
                    <span className="import-preview-row__text">
                      {row.description}
                      <span className="import-preview-row__meta">
                        {' '}
                        · {row.category} · {row.competenceDate} ·{' '}
                        {row.type ? TYPE_LABELS[row.type] : ''}
                      </span>
                    </span>
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
                return (
                  <fieldset key={name} className="import-mapping">
                    <legend>{name || '(sem categoria)'}</legend>
                    <label>
                      Ação
                      <select
                        value={draft?.mode ?? 'create'}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [name]: {
                              mode: event.target.value as MappingDraft['mode'],
                              categoryId: current[name]?.categoryId ?? '',
                              name: current[name]?.name ?? name,
                            },
                          }))
                        }
                      >
                        <option value="create">Criar nova</option>
                        <option value="existing">Usar existente</option>
                      </select>
                    </label>
                    {draft?.mode === 'existing' ? (
                      <label>
                        Categoria
                        <select
                          value={draft.categoryId}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [name]: {
                                ...current[name],
                                categoryId: event.target.value,
                              },
                            }))
                          }
                        >
                          <option value="">Selecione</option>
                          {leaves.map((leaf) => (
                            <option key={leaf.id} value={leaf.id}>
                              {leaf.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label>
                        Nome da nova categoria
                        <input
                          value={draft?.name ?? name}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [name]: {
                                mode: 'create',
                                categoryId: '',
                                name: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                    )}
                  </fieldset>
                );
              })}
            </div>
          ) : null}

          <div className="form-actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canConfirm || busy !== null}
              onClick={() => void handleConfirm()}
            >
              Confirmar importação
            </button>
          </div>
        </section>
      ) : null}

      {result ? (
        <div className="import-result" role="status">
          <p className="status-pill status-pill--success">
            {result.created} criados, {result.skipped} ignorados
            {result.errors.length > 0
              ? `, ${result.errors.length} erros`
              : ''}
            .
          </p>
          <Link to="/lancamentos" className="btn btn--secondary btn--compact">
            Ver lançamentos
          </Link>
        </div>
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
              <li key={item.id}>
                <strong>{item.fileName}</strong>
                <span>
                  {item.importMode === 'invoice'
                    ? (item.cardLabel ?? 'Cartão')
                    : (item.accountLabel ?? 'Conta')}{' '}
                  · {item.createdCount} criados, {item.skippedCount} ignorados
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
