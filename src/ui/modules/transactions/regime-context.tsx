import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Regime } from '../../components/regime-toggle';

type RegimeContextValue = {
  regime: Regime;
  setRegime: (regime: Regime) => void;
};

const RegimeContext = createContext<RegimeContextValue | null>(null);

export function RegimeProvider({ children }: { children: ReactNode }) {
  const [regime, setRegime] = useState<Regime>('competence');
  const value = useMemo(() => ({ regime, setRegime }), [regime]);
  return (
    <RegimeContext.Provider value={value}>{children}</RegimeContext.Provider>
  );
}

export function useRegime(): RegimeContextValue {
  const ctx = useContext(RegimeContext);
  if (!ctx) {
    throw new Error('useRegime must be used within RegimeProvider');
  }
  return ctx;
}
