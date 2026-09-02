import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './modules/auth/auth-context';
import { useAuth } from './modules/auth/use-auth';
import { AppRouter } from './router';

function AppHeader() {
  const { user, logout, loading } = useAuth();

  async function handleLogout() {
    await logout();
  }

  return (
    <header className="app-header">
      <p className="brand">Mão de Vaca</p>
      {!loading && user ? (
        <button type="button" className="logout-button" onClick={handleLogout}>
          Sair
        </button>
      ) : null}
    </header>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app-shell">
          <AppHeader />
          <main className="app-main">
            <AppRouter />
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
