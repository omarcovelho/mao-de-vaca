import { Navigate, Outlet } from 'react-router-dom';
import { useSetupStatus } from '../modules/accounts/setup-status-context';

export function RequiresOrigins() {
  const { loading, isOnboardingComplete } = useSetupStatus();

  if (loading) {
    return <p className="app-loading">Carregando…</p>;
  }

  if (!isOnboardingComplete) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
