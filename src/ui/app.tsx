import { BrowserRouter } from 'react-router-dom';
import { SetupStatusProvider } from './modules/accounts/setup-status-context';
import { AuthProvider } from './modules/auth/auth-context';
import { RegimeProvider } from './modules/transactions/regime-context';
import { AppRouter } from './router';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SetupStatusProvider>
          <RegimeProvider>
            <AppRouter />
          </RegimeProvider>
        </SetupStatusProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
