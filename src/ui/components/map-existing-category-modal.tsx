import { ReactNode, useEffect, useId, useRef } from 'react';
import { SearchableSelect } from './searchable-select';
import type { SearchableSelectOption } from './searchable-select';

type MapExistingCategoryModalProps = {
  open: boolean;
  title?: string;
  description?: ReactNode;
  categoryName?: string;
  categoryId: string;
  options: SearchableSelectOption[];
  confirmLabel?: string;
  busy?: boolean;
  onCategoryIdChange: (categoryId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function MapExistingCategoryModal({
  open,
  title = 'Usar categoria existente',
  description,
  categoryName,
  categoryId,
  options,
  confirmLabel = 'Confirmar',
  busy = false,
  onCategoryIdChange,
  onConfirm,
  onCancel,
}: MapExistingCategoryModalProps) {
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    confirmRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) {
        onCancel();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel, open]);

  if (!open) {
    return null;
  }

  const body =
    description ??
    (categoryName ? (
      <p className="form-hint" style={{ margin: 0 }}>
        Mapear <strong>{categoryName}</strong> para uma folha já cadastrada.
      </p>
    ) : null);

  return (
    <div
      className="confirm-modal__backdrop"
      data-testid="map-existing-category-modal-backdrop"
      onClick={() => {
        if (!busy) {
          onCancel();
        }
      }}
    >
      <div
        className="confirm-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="confirm-modal__title">
          {title}
        </h2>
        <div className="confirm-modal__description form-stack">
          {body}
          <label>
            Categoria
            <SearchableSelect
              aria-label="Categoria"
              options={options}
              value={categoryId}
              onChange={onCategoryIdChange}
              placeholder="Selecione…"
              disabled={busy}
            />
          </label>
        </div>
        <div className="confirm-modal__actions">
          <button
            type="button"
            className="btn btn--secondary"
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn btn--primary"
            disabled={!categoryId || busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
