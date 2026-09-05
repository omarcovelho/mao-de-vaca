import {
  KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { SearchableSelectOption } from './searchable-select';

type SearchableMultiSelectProps = {
  id?: string;
  options: SearchableSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  emptyMessage?: string;
  disabled?: boolean;
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

export function SearchableMultiSelect({
  id,
  options,
  value,
  onChange,
  emptyMessage = 'Nenhuma opção encontrada',
  disabled = false,
  emptyLabel = 'Todas',
  'aria-label': ariaLabel,
  className,
}: SearchableMultiSelectProps) {
  const generatedId = useId();
  const listboxId = `${generatedId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [highlight, setHighlight] = useState(0);

  const selectedSet = useMemo(() => new Set(value), [value]);

  const selectedLabel = useMemo(() => {
    if (value.length === 0) {
      return emptyLabel;
    }
    return 'Adicionar…';
  }, [emptyLabel, value.length]);

  const filtered = useMemo(
    () => options.filter((opt) => matchesFilter(opt.label, filter)),
    [filter, options],
  );

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

  function toggleValue(next: string) {
    if (selectedSet.has(next)) {
      onChange(value.filter((id) => id !== next));
    } else {
      onChange([...value, next]);
    }
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
        toggleValue(option.value);
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
            value.length === 0
              ? 'searchable-select__placeholder'
              : 'searchable-select__value'
          }
        >
          {selectedLabel}
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
          {value.length > 0 ? (
            <button
              type="button"
              className="searchable-select__footer-action"
              onClick={() => onChange([])}
            >
              Limpar seleção
            </button>
          ) : null}
          {filtered.length === 0 ? (
            <p className="searchable-select__empty">{emptyMessage}</p>
          ) : (
            <ul
              id={listboxId}
              className="searchable-select__list"
              role="listbox"
              aria-multiselectable
              aria-label={ariaLabel}
            >
              {filtered.map((option, index) => {
                const selected = selectedSet.has(option.value);
                return (
                  <li key={`${option.value}-${option.label}`} role="presentation">
                    <button
                      type="button"
                      role="option"
                      className={
                        index === highlight
                          ? 'searchable-select__option searchable-select__option--active'
                          : 'searchable-select__option'
                      }
                      aria-selected={selected}
                      disabled={option.disabled}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => toggleValue(option.value)}
                    >
                      <span className="searchable-select__check" aria-hidden>
                        {selected ? '✓' : ''}
                      </span>
                      {option.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
