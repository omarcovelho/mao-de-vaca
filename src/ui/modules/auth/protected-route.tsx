import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './use-auth';

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="app-loading">Carregando…</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
