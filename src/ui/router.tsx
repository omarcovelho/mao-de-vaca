import { Route, Routes } from 'react-router-dom';
import { LoginPage } from './modules/auth/login-page';
import { ProtectedRoute } from './modules/auth/protected-route';

function HomePage() {
  return (
    <section className="home">
      <h1>Bem-vindo</h1>
      <p>O aplicativo está no ar. Em breve você poderá cadastrar contas e importar extratos.</p>
    </section>
  );
}

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
    </Routes>
  );
}
