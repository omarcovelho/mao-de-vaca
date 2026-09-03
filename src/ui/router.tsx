import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/app-shell';
import { ComingSoonPage } from './components/coming-soon-page';
import { RequiresOrigins } from './components/requires-origins';
import { AccountsPage } from './modules/accounts/accounts-page';
import { CardsPage } from './modules/accounts/cards-page';
import { HomePage } from './modules/accounts/home-page';
import { LoginPage } from './modules/auth/login-page';
import { ProtectedRoute } from './modules/auth/protected-route';
import { CategoriesPage } from './modules/categories/categories-page';
import { ImportPage } from './modules/import/import-page';
import { TransactionsPage } from './modules/transactions/transactions-page';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/contas" element={<AccountsPage />} />
          <Route path="/cartoes" element={<CardsPage />} />
          <Route path="/categorias" element={<CategoriesPage />} />
          <Route element={<RequiresOrigins />}>
            <Route path="/lancamentos" element={<TransactionsPage />} />
            <Route path="/importar" element={<ImportPage />} />
            <Route
              path="/relatorios"
              element={
                <ComingSoonPage
                  title="Relatórios"
                  subtitle="Evolução dos últimos meses"
                  message="Gráficos e indicadores estarão disponíveis após os lançamentos serem importados."
                />
              }
            />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
