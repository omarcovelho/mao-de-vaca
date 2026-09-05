import { ReactNode, useEffect, useId, useRef } from 'react';

type FormModalProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  busy?: boolean;
  wide?: boolean;
  onClose: () => void;
};

export function FormModal({
  open,
  title,
  description,
  children,
  busy = false,
  wide = false,
  onClose,
}: FormModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])',
    );
    focusable?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy && !event.defaultPrevented) {
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="confirm-modal__backdrop"
      data-testid="form-modal-backdrop"
      onClick={() => {
        if (!busy) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className={`confirm-modal__dialog${wide ? ' confirm-modal__dialog--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="confirm-modal__title">
          {title}
        </h2>
        {description ? (
          <div className="confirm-modal__description">{description}</div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
