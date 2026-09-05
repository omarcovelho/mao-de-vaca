import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import {
  AccountOriginIcon,
  CardOriginIcon,
} from '../../components/origin-icon';
import { PlusGlyph, TrashGlyph } from '../categories/category-icons';
import type { Origin } from './types';

type OriginCardProps = {
  item: Origin;
  kind: 'account' | 'card';
  onDeactivate: (id: string) => void;
  onSelect?: (id: string) => void;
};

export function OriginCard({
  item,
  kind,
  onDeactivate,
  onSelect,
}: OriginCardProps) {
  const selectable = Boolean(onSelect);
  const Icon = kind === 'card' ? CardOriginIcon : AccountOriginIcon;

  function handleSelect() {
    onSelect?.(item.id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!selectable) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSelect();
    }
  }

  function handleDeactivate(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onDeactivate(item.id);
  }

  const body: ReactNode = (
    <>
      <span className="origin-card__icon" aria-hidden>
        <Icon />
      </span>
      <div className="origin-card__body">
        <span className="origin-card__title">{item.label}</span>
        <span className="bank-pill">{item.bank.name}</span>
      </div>
    </>
  );

  return (
    <li className="origin-card">
      {selectable ? (
        <div
          className="origin-card__main origin-card__main--button"
          role="button"
          tabIndex={0}
          onClick={handleSelect}
          onKeyDown={handleKeyDown}
          aria-label={`Abrir ${item.label}`}
        >
          {body}
        </div>
      ) : (
        <div className="origin-card__main">{body}</div>
      )}
      <button
        type="button"
        className="btn btn--ghost btn--icon btn--icon-danger origin-card__deactivate"
        aria-label={`Desativar ${item.label}`}
        onClick={handleDeactivate}
      >
        <TrashGlyph />
      </button>
    </li>
  );
}

type OriginAddCardProps = {
  label: string;
  onClick: () => void;
};

export function OriginAddCard({ label, onClick }: OriginAddCardProps) {
  return (
    <li>
      <button
        type="button"
        className="origin-card origin-card--add"
        onClick={onClick}
        aria-label={label}
      >
        <span className="origin-card__add-icon" aria-hidden>
          <PlusGlyph />
        </span>
        <span className="origin-card__add-label">{label}</span>
      </button>
    </li>
  );
}

type OriginCardsProps = {
  children: ReactNode;
};

export function OriginCards({ children }: OriginCardsProps) {
  return <ul className="origin-cards">{children}</ul>;
}
