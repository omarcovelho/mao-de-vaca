import { KeyboardEvent, useEffect, useId, useRef, useState } from 'react';

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

const PRESET_COLORS = [
  '#4A5568',
  '#805AD5',
  '#DD6B20',
  '#E53E3E',
  '#3182CE',
  '#38A169',
  '#D69E2E',
  '#ED8936',
  '#9F7AEA',
  '#4299E1',
  '#0BC5EA',
  '#F687B3',
  '#48BB78',
  '#A0AEC0',
  '#276749',
  '#718096',
] as const;

function sameColor(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function parseHex(value: string): string | null {
  const trimmed = value.trim();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return HEX_RE.test(withHash) ? withHash.toUpperCase() : null;
}

type ColorSwatchPickerProps = {
  value: string;
  labelledBy?: string;
  onChange: (color: string) => void;
};

export function ColorSwatchPicker({
  value,
  labelledBy,
  onChange,
}: ColorSwatchPickerProps) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const hexRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState(value);

  useEffect(() => {
    if (open) {
      setHexDraft(value);
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  function commitHex() {
    const parsed = parseHex(hexDraft);
    if (!parsed) {
      setHexDraft(value);
      return;
    }
    onChange(parsed);
  }

  function onHexKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitHex();
      setOpen(false);
    }
  }

  function selectColor(color: string) {
    onChange(color);
    setHexDraft(color);
    setOpen(false);
  }

  return (
    <div className="color-swatch-picker" ref={rootRef}>
      <button
        type="button"
        className="color-swatch-picker__swatch"
        aria-label="Cor"
        aria-labelledby={labelledBy}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        style={{ background: value }}
        onClick={() => setOpen((current) => !current)}
      />
      {open ? (
        <div
          id={panelId}
          className="color-swatch-picker__panel"
          role="dialog"
          aria-label="Escolher cor"
        >
          <div className="color-swatch-picker__grid" role="listbox" aria-label="Cores">
            {PRESET_COLORS.map((color) => {
              const selected = sameColor(color, value);
              return (
                <button
                  key={color}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-label={color}
                  className={`color-swatch-picker__option${
                    selected ? ' color-swatch-picker__option--selected' : ''
                  }`}
                  style={{ background: color }}
                  onClick={() => selectColor(color)}
                />
              );
            })}
          </div>
          <label className="color-swatch-picker__hex-field">
            Hex
            <input
              ref={hexRef}
              className="color-swatch-picker__hex"
              value={hexDraft}
              spellCheck={false}
              autoComplete="off"
              aria-label="Código hexadecimal"
              onChange={(event) => setHexDraft(event.target.value)}
              onBlur={commitHex}
              onKeyDown={onHexKeyDown}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
