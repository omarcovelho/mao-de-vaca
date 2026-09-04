import { useEffect, useId, useRef } from 'react';
import { SearchableSelect } from './searchable-select';
import type { SearchableSelectOption } from './searchable-select';

type CreateImportCategoryModalProps = {
  open: boolean;
  categoryName: string;
  parentId: string;
  parentOptions: SearchableSelectOption[];
  onParentIdChange: (parentId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function CreateImportCategoryModal({
  open,
  categoryName,
  parentId,
  parentOptions,
  onParentIdChange,
  onConfirm,
  onCancel,
}: CreateImportCategoryModalProps) {
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    confirmRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="confirm-modal__backdrop"
      data-testid="create-category-modal-backdrop"
      onClick={onCancel}
    >
      <div
        className="confirm-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="confirm-modal__title">
          Nova categoria
        </h2>
        <div className="confirm-modal__description form-stack">
          <label>
            Nome
            <input value={categoryName} readOnly disabled />
          </label>
          <label>
            Categoria pai
            <SearchableSelect
              aria-label="Categoria pai"
              options={parentOptions}
              value={parentId}
              onChange={onParentIdChange}
              allowEmpty
              emptyLabel="Nenhuma (criar como raiz)"
              placeholder="Selecione…"
            />
          </label>
          <p className="form-hint">
            Sem pai, a categoria é criada na raiz. Com pai, ela nasce como
            subcategoria.
          </p>
        </div>
        <div className="confirm-modal__actions">
          <button type="button" className="btn btn--secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn btn--primary"
            onClick={onConfirm}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
