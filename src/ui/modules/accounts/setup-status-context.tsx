import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as accountsApi from './api';
import {
  isOnboardingFinalized,
  isOnboardingStarted,
  markOnboardingFinalized,
  markOnboardingStarted,
} from './onboarding-session';
import type { SetupStatus } from './types';

type SetupStatusContextValue = {
  status: SetupStatus | null;
  loading: boolean;
  hasOrigins: boolean;
  isOnboardingComplete: boolean;
  reload: () => Promise<void>;
  startOnboarding: () => void;
  finalizeOnboarding: () => void;
};

const SetupStatusContext = createContext<SetupStatusContextValue | null>(null);

export function SetupStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(
    isOnboardingFinalized,
  );

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await accountsApi.getSetupStatus();
      setStatus(next);

      const hasOrigins = Boolean(next.hasAccounts || next.hasCards);
      if (hasOrigins && !isOnboardingStarted() && !isOnboardingFinalized()) {
        markOnboardingFinalized();
        setIsOnboardingComplete(true);
      }
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const startOnboarding = useCallback(() => {
    markOnboardingStarted();
    setIsOnboardingComplete(false);
  }, []);

  const finalizeOnboarding = useCallback(() => {
    markOnboardingFinalized();
    setIsOnboardingComplete(true);
  }, []);

  const value = useMemo(
    () => ({
      status,
      loading,
      hasOrigins: Boolean(status?.hasAccounts || status?.hasCards),
      isOnboardingComplete,
      reload,
      startOnboarding,
      finalizeOnboarding,
    }),
    [
      status,
      loading,
      isOnboardingComplete,
      reload,
      startOnboarding,
      finalizeOnboarding,
    ],
  );

  return (
    <SetupStatusContext.Provider value={value}>
      {children}
    </SetupStatusContext.Provider>
  );
}

export function useSetupStatus(): SetupStatusContextValue {
  const context = useContext(SetupStatusContext);
  if (!context) {
    throw new Error('useSetupStatus must be used within SetupStatusProvider');
  }
  return context;
}
