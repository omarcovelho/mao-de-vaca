import { BrowserRouter, Link } from 'react-router-dom';
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
      <div className="header-brand">
        <p className="brand">
          <Link to="/">Mão de Vaca</Link>
        </p>
        {!loading && user ? (
          <nav className="app-nav" aria-label="Principal">
            <Link to="/contas">Contas</Link>
            <Link to="/cartoes">Cartões</Link>
          </nav>
        ) : null}
      </div>
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
