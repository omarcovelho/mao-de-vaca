import { createContext } from 'react';
import type { AuthUser, LoginCredentials } from './types';

export type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
