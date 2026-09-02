import { BrowserRouter } from 'react-router-dom';
import { SetupStatusProvider } from './modules/accounts/setup-status-context';
import { AuthProvider } from './modules/auth/auth-context';
import { AppRouter } from './router';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SetupStatusProvider>
          <AppRouter />
        </SetupStatusProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
