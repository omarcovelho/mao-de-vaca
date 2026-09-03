import { type ReactNode, useCallback, useEffect, useState } from 'react';
import * as authApi from './api';
import { AuthContext } from './auth-context-value';
import type { AuthUser, LoginCredentials } from './types';
import { clearOnboardingSession } from '../accounts/onboarding-session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    clearOnboardingSession();
    setUser(null);
  }, []);

  useEffect(() => {
    authApi.setUnauthorizedHandler(clearSession);
    return () => authApi.setUnauthorizedHandler(null);
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const current = await authApi.me();
        if (!cancelled) {
          setUser(current);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const nextUser = await authApi.login(credentials);
    setUser(nextUser);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    clearOnboardingSession();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
