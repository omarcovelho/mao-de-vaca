import { Route, Routes } from 'react-router-dom';
import { AccountsPage } from './modules/accounts/accounts-page';
import { CardsPage } from './modules/accounts/cards-page';
import { HomePage } from './modules/accounts/home-page';
import { LoginPage } from './modules/auth/login-page';
import { ProtectedRoute } from './modules/auth/protected-route';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contas"
        element={
          <ProtectedRoute>
            <AccountsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cartoes"
        element={
          <ProtectedRoute>
            <CardsPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
