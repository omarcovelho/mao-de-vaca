export type Regime = 'competence' | 'cash';

type RegimeToggleProps = {
  value: Regime;
  onChange: (value: Regime) => void;
};

export function RegimeToggle({ value, onChange }: RegimeToggleProps) {
  return (
    <div className="pill-group" role="group" aria-label="Regime contábil">
      <button
        type="button"
        className={`pill${value === 'competence' ? ' pill--active' : ''}`}
        onClick={() => onChange('competence')}
        aria-pressed={value === 'competence'}
      >
        Competência
      </button>
      <button
        type="button"
        className={`pill${value === 'cash' ? ' pill--active' : ''}`}
        onClick={() => onChange('cash')}
        aria-pressed={value === 'cash'}
      >
        Caixa
      </button>
    </div>
  );
}
