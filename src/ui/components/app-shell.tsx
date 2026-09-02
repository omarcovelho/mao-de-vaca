import { NavLink, Outlet } from 'react-router-dom';
import { useSetupStatus } from '../modules/accounts/setup-status-context';
import { useAuth } from '../modules/auth/use-auth';

const NAV_ITEMS = [
  { to: '/', label: 'Visão geral', end: true },
  { to: '/lancamentos', label: 'Lançamentos' },
  { to: '/importar', label: 'Importar' },
  { to: '/contas', label: 'Contas' },
  { to: '/cartoes', label: 'Cartões' },
  { to: '/relatorios', label: 'Relatórios' },
] as const;

export function AppShell() {
  const { logout } = useAuth();
  const { loading, isOnboardingComplete } = useSetupStatus();

  async function handleLogout() {
    await logout();
  }

  if (loading) {
    return <p className="app-loading">Carregando…</p>;
  }

  if (!isOnboardingComplete) {
    return (
      <div className="app-setup">
        <header className="app-setup__header">
          <p className="app-setup__brand">Mão de Vaca</p>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void handleLogout()}
          >
            Sair
          </button>
        </header>
        <main className="app-setup__content">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <aside className="app-sidebar" aria-label="Navegação principal">
        <p className="app-sidebar__brand">Mão de Vaca</p>
        <nav className="app-sidebar__nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `app-sidebar__link${isActive ? ' app-sidebar__link--active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          className="btn btn--ghost app-sidebar__logout"
          onClick={() => void handleLogout()}
        >
          Sair
        </button>
      </aside>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
