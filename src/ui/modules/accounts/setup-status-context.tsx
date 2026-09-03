import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../auth/use-auth';
import * as accountsApi from './api';
import {
  clearOnboardingSession,
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

function syncOnboardingComplete(status: SetupStatus): boolean {
  const hasOrigins = Boolean(status.hasAccounts || status.hasCards);

  if (!hasOrigins) {
    clearOnboardingSession();
    return false;
  }

  if (isOnboardingFinalized()) {
    return true;
  }

  if (isOnboardingStarted()) {
    return false;
  }

  markOnboardingFinalized();
  return true;
}

export function SetupStatusProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await accountsApi.getSetupStatus();
      setStatus(next);
      setIsOnboardingComplete(syncOnboardingComplete(next));
    } catch {
      setStatus(null);
      setIsOnboardingComplete(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setStatus(null);
      setIsOnboardingComplete(false);
      setLoading(false);
      return;
    }

    void reload();
  }, [authLoading, user, reload]);

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
      loading: authLoading || loading,
      hasOrigins: Boolean(status?.hasAccounts || status?.hasCards),
      isOnboardingComplete,
      reload,
      startOnboarding,
      finalizeOnboarding,
    }),
    [
      status,
      authLoading,
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
