import {
  KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

export type SearchableSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SearchableSelectProps = {
  id?: string;
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  'aria-label'?: string;
  className?: string;
};

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function matchesFilter(label: string, filter: string): boolean {
  if (!filter.trim()) {
    return true;
  }
  return normalize(label).includes(normalize(filter));
}

export function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder = 'Selecione…',
  emptyMessage = 'Nenhuma opção encontrada',
  disabled = false,
  allowEmpty = false,
  emptyLabel = 'Nenhuma',
  'aria-label': ariaLabel,
  className,
}: SearchableSelectProps) {
  const generatedId = useId();
  const listboxId = `${generatedId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [highlight, setHighlight] = useState(0);

  const selectedLabel = useMemo(() => {
    if (allowEmpty && value === '') {
      return emptyLabel;
    }
    return options.find((opt) => opt.value === value)?.label;
  }, [allowEmpty, emptyLabel, options, value]);

  const filtered = useMemo(() => {
    const base = allowEmpty
      ? [{ value: '', label: emptyLabel }, ...options]
      : options;
    return base.filter((opt) => matchesFilter(opt.label, filter));
  }, [allowEmpty, emptyLabel, filter, options]);

  useEffect(() => {
    if (!open) {
      return;
    }
    filterRef.current?.focus();
    setHighlight(0);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setFilter('');
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function close() {
    setOpen(false);
    setFilter('');
  }

  function selectValue(next: string) {
    onChange(next);
    close();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
    }
  }

  function onFilterKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((current) =>
        filtered.length === 0 ? 0 : Math.min(current + 1, filtered.length - 1),
      );
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[highlight];
      if (option && !option.disabled) {
        selectValue(option.value);
      }
    }
  }

  const rootClass = ['searchable-select', className].filter(Boolean).join(' ');

  return (
    <div className={rootClass} ref={rootRef}>
      <button
        type="button"
        id={id}
        className="searchable-select__trigger"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current);
          }
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span
          className={
            selectedLabel
              ? 'searchable-select__value'
              : 'searchable-select__placeholder'
          }
        >
          {selectedLabel ?? placeholder}
        </span>
        <span className="searchable-select__chevron" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div className="searchable-select__panel">
          <input
            ref={filterRef}
            type="text"
            className="searchable-select__filter"
            role="textbox"
            aria-label="Filtrar opções"
            aria-controls={listboxId}
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setHighlight(0);
            }}
            onKeyDown={onFilterKeyDown}
          />
          {filtered.length === 0 ? (
            <p className="searchable-select__empty">{emptyMessage}</p>
          ) : (
            <ul
              id={listboxId}
              className="searchable-select__list"
              role="listbox"
              aria-label={ariaLabel}
            >
              {filtered.map((option, index) => (
                <li key={`${option.value}-${option.label}`} role="presentation">
                  <button
                    type="button"
                    role="option"
                    className={
                      index === highlight
                        ? 'searchable-select__option searchable-select__option--active'
                        : 'searchable-select__option'
                    }
                    aria-selected={option.value === value}
                    disabled={option.disabled}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => selectValue(option.value)}
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
