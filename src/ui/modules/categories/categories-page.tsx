import { FormEvent, useEffect, useState } from 'react';
import { ConfirmModal } from '../../components/confirm-modal';
import { PageHeader } from '../../components/page-header';
import { SearchableSelect } from '../../components/searchable-select';
import { useToast } from '../../components/toast';
import * as categoriesApi from './api';
import {
  CATEGORY_ICON_OPTIONS,
  CategoryIcon,
  KIND_LABELS,
} from './category-icons';
import type { Category, CategoryKind } from './types';

const MAX_DEPTH = 5;

const KIND_OPTIONS = [
  { value: 'EXPENSE', label: 'Gasto' },
  { value: 'INCOME', label: 'Renda' },
];

const ICON_OPTIONS = CATEGORY_ICON_OPTIONS.map((option) => ({
  value: option.key,
  label: option.label,
}));

function CategoryTreeRows({
  nodes,
  expandedIds,
  onToggle,
  onAddChild,
  onEdit,
  onDeactivate,
}: {
  nodes: Category[];
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onAddChild: (category: Category) => void;
  onEdit: (category: Category) => void;
  onDeactivate: (id: string) => void;
}) {
  return (
    <ul className="category-tree">
      {nodes.map((node) => {
        const hasChildren = Boolean(node.children?.length);
        const expanded = expandedIds.has(node.id);

        return (
          <li key={node.id} className="category-tree__item">
            <div
              className="category-row"
              style={{ paddingLeft: `${0.5 + (node.depth - 1) * 0.85}rem` }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  className="category-row__toggle"
                  aria-expanded={expanded}
                  aria-label={expanded ? 'Recolher' : 'Expandir'}
                  onClick={() => onToggle(node.id)}
                >
                  {expanded ? '▾' : '▸'}
                </button>
              ) : (
                <span className="category-row__toggle category-row__toggle--spacer" />
              )}

              <span
                className="category-swatch"
                style={{ ['--swatch' as string]: node.color }}
                aria-hidden
              >
                <CategoryIcon icon={node.icon} />
              </span>

              <div className="category-row__body">
                <span className="category-row__name">{node.name}</span>
                {node.depth === 1 ? (
                  <span className="category-row__kind">
                    {KIND_LABELS[node.kind] ?? node.kind}
                  </span>
                ) : null}
              </div>

              <div className="category-row__actions">
                {!node.systemKey && node.depth < MAX_DEPTH ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--compact"
                    onClick={() => onAddChild(node)}
                  >
                    Nova subcategoria
                    <span className="visually-hidden"> em {node.name}</span>
                  </button>
                ) : null}
                {!node.systemKey ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--compact"
                    onClick={() => onEdit(node)}
                  >
                    Editar
                  </button>
                ) : null}
                {!node.systemKey ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--compact"
                    onClick={() => onDeactivate(node.id)}
                  >
                    Desativar
                  </button>
                ) : (
                  <span className="category-row__kind">Sistema</span>
                )}
              </div>
            </div>

            {hasChildren && expanded ? (
              <CategoryTreeRows
                nodes={node.children!}
                expandedIds={expandedIds}
                onToggle={onToggle}
                onAddChild={onAddChild}
                onEdit={onEdit}
                onDeactivate={onDeactivate}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function CategoriesPage() {
  const toast = useToast();
  const [tree, setTree] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<CategoryKind>('EXPENSE');
  const [parentId, setParentId] = useState('');
  const [color, setColor] = useState('#4A5568');
  const [icon, setIcon] = useState('tag');
  const [mode, setMode] = useState<'root' | 'child'>('root');
  const [parentName, setParentName] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setTree(await categoriesApi.listCategories());
    } catch {
      setError('Não foi possível carregar as categorias.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function resetForm() {
    setName('');
    setKind('EXPENSE');
    setParentId('');
    setParentName('');
    setColor('#4A5568');
    setIcon('tag');
    setMode('root');
    setEditing(null);
  }

  function openCreateRoot() {
    resetForm();
    setMode('root');
    setShowForm(true);
  }

  function openCreateChild(parent: Category) {
    resetForm();
    setMode('child');
    setParentId(parent.id);
    setParentName(parent.name);
    setColor(parent.color);
    setIcon(parent.icon);
    setKind(parent.kind);
    setExpandedIds((current) => new Set(current).add(parent.id));
    setShowForm(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setName(category.name);
    setColor(category.color);
    setIcon(category.icon);
    setKind(category.kind);
    setParentId(category.parentId ?? '');
    setMode(category.parentId ? 'child' : 'root');
    setShowForm(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (editing) {
        await categoriesApi.updateCategory(editing.id, { name, color, icon });
      } else if (mode === 'root') {
        await categoriesApi.createCategory({ name, kind, color, icon });
      } else {
        if (!parentId) {
          setError('Selecione a categoria pai.');
          setSubmitting(false);
          return;
        }
        await categoriesApi.createCategory({
          name,
          parentId,
          color,
          icon,
        });
        setExpandedIds((current) => new Set(current).add(parentId));
      }
      resetForm();
      setShowForm(false);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível salvar.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function runDeactivate() {
    if (!deactivateId) {
      return;
    }
    setDeactivating(true);
    setError(null);
    try {
      await categoriesApi.deactivateCategory(deactivateId);
      setDeactivateId(null);
      await load();
      toast.success('Categoria desativada.');
    } catch {
      const message = 'Não foi possível desativar a categoria.';
      setError(message);
      toast.error(message);
    } finally {
      setDeactivating(false);
    }
  }

  function findCategoryName(nodes: Category[], id: string): string | null {
    for (const node of nodes) {
      if (node.id === id) {
        return node.name;
      }
      if (node.children?.length) {
        const found = findCategoryName(node.children, id);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  return (
    <section className="page">
      <PageHeader
        title="Categorias"
        subtitle="Organize gastos, renda e não-despesas"
        trailing={
          <button
            type="button"
            className="btn btn--primary"
            onClick={openCreateRoot}
          >
            Nova categoria
          </button>
        }
      />

      {error ? <p className="alert" role="alert">{error}</p> : null}

      {showForm ? (
        <form className="form-panel" onSubmit={(e) => void handleSubmit(e)}>
          <h2 className="form-panel__title">
            {editing
              ? 'Editar categoria'
              : mode === 'root'
                ? 'Nova categoria'
                : 'Nova subcategoria'}
          </h2>
          <div className="form-stack">
            <label>
              Nome
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>

            {!editing && mode === 'root' ? (
              <label>
                Tipo
                <SearchableSelect
                  aria-label="Tipo"
                  options={KIND_OPTIONS}
                  value={kind}
                  onChange={(value) => setKind(value as CategoryKind)}
                />
              </label>
            ) : null}

            {!editing && mode === 'child' ? (
              <p className="form-hint">Em {parentName}</p>
            ) : null}

            <label>
              Cor
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>

            <label>
              Ícone
              <SearchableSelect
                aria-label="Ícone"
                options={ICON_OPTIONS}
                value={icon}
                onChange={setIcon}
              />
            </label>

            <div className="category-icon-preview" aria-hidden>
              <span
                className="category-swatch"
                style={{ ['--swatch' as string]: color }}
              >
                <CategoryIcon icon={icon} />
              </span>
              <span className="category-icon-preview__label">Pré-visualização</span>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={submitting}
              >
                {submitting ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="page__empty">Carregando…</p>
      ) : tree.length === 0 ? (
        <p className="page__empty">
          Nenhuma categoria ativa. Cadastre categorias para classificar seus
          lançamentos.
        </p>
      ) : (
        <CategoryTreeRows
          nodes={tree}
          expandedIds={expandedIds}
          onToggle={toggleExpanded}
          onAddChild={openCreateChild}
          onEdit={openEdit}
          onDeactivate={setDeactivateId}
        />
      )}

      <ConfirmModal
        open={deactivateId !== null}
        title="Desativar categoria"
        description={
          deactivateId
            ? `Desativar “${findCategoryName(tree, deactivateId) ?? 'esta categoria'}”? Subcategorias também serão desativadas.`
            : null
        }
        confirmLabel="Desativar"
        variant="danger"
        busy={deactivating}
        onCancel={() => {
          if (!deactivating) {
            setDeactivateId(null);
          }
        }}
        onConfirm={() => void runDeactivate()}
      />
    </section>
  );
}
