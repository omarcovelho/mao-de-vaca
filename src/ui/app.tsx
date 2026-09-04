import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from './components/toast';
import { SetupStatusProvider } from './modules/accounts/setup-status-context';
import { AuthProvider } from './modules/auth/auth-context';
import { RegimeProvider } from './modules/transactions/regime-context';
import { AppRouter } from './router';

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <SetupStatusProvider>
            <RegimeProvider>
              <AppRouter />
            </RegimeProvider>
          </SetupStatusProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
