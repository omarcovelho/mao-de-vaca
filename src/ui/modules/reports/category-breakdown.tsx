import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TxCategoryChip } from '../transactions/tx-category-chip';
import type { ByCategoryItem } from './types';

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatPercent(value: number): string {
  return `${value.toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })}%`;
}

function categoryKey(item: ByCategoryItem): string {
  return item.categoryId ?? '__uncategorized__';
}

type CategoryBreakdownProps = {
  items: ByCategoryItem[];
  limit?: number;
  emptyMessage?: string;
  /** When set, leaf rows link to this path (e.g. lançamentos with filters). */
  leafTo?: (item: ByCategoryItem) => string | null;
};

type CategoryBreakdownNodeProps = {
  item: ByCategoryItem;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  leafTo?: (item: ByCategoryItem) => string | null;
};

function CategoryBreakdownNode({
  item,
  depth,
  expandedIds,
  onToggle,
  leafTo,
}: CategoryBreakdownNodeProps) {
  const key = categoryKey(item);
  const hasChildren = item.children.length > 0;
  const expanded = expandedIds.has(key);
  const href = !hasChildren && leafTo ? leafTo(item) : null;

  const chip = (
    <TxCategoryChip
      category={{
        name: item.name,
        color: item.color,
        icon: item.icon,
      }}
    />
  );

  const label = href ? (
    <Link to={href} className="category-breakdown__chip-link">
      {chip}
    </Link>
  ) : (
    chip
  );

  return (
    <li className="category-breakdown__item">
      <div
        className="category-breakdown__row"
        style={{ paddingLeft: `${depth * 0.85}rem` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="category-breakdown__toggle"
            aria-expanded={expanded}
            aria-label={
              expanded
                ? `Recolher ${item.name}`
                : `Expandir ${item.name}`
            }
            onClick={() => onToggle(key)}
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span
            className="category-breakdown__toggle category-breakdown__toggle--spacer"
            aria-hidden
          />
        )}

        <div className="category-breakdown__meta">
          {label}
          <span className="category-breakdown__percent">
            {formatPercent(item.percent)}
          </span>
          <span className="category-breakdown__total">
            {formatMoney(item.total)}
          </span>
        </div>
      </div>

      <div
        className="category-breakdown__bar"
        role="presentation"
        aria-hidden
        style={{ marginLeft: `${depth * 0.85 + 1.5}rem` }}
      >
        <span
          className="category-breakdown__bar-fill"
          style={{
            width: `${Math.min(100, Math.max(0, item.percent))}%`,
            background: item.color,
          }}
        />
      </div>

      {hasChildren && expanded ? (
        <ul className="category-breakdown category-breakdown--nested">
          {item.children.map((child) => (
            <CategoryBreakdownNode
              key={categoryKey(child)}
              item={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              leafTo={leafTo}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function CategoryBreakdown({
  items,
  limit,
  emptyMessage = 'Importe extratos para ver a distribuição por categoria.',
  leafTo,
}: CategoryBreakdownProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const visible = limit === undefined ? items : items.slice(0, limit);

  if (visible.length === 0) {
    return <p className="page__empty">{emptyMessage}</p>;
  }

  function toggle(id: string) {
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

  return (
    <ul className="category-breakdown">
      {visible.map((item) => (
        <CategoryBreakdownNode
          key={categoryKey(item)}
          item={item}
          depth={0}
          expandedIds={expandedIds}
          onToggle={toggle}
          leafTo={leafTo}
        />
      ))}
    </ul>
  );
}
