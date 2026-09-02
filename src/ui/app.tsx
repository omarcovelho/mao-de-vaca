import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './router';

export function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-header">
          <p className="brand">Mão de Vaca</p>
        </header>
        <main className="app-main">
          <AppRouter />
        </main>
      </div>
    </BrowserRouter>
  );
}
