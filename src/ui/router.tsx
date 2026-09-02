import { Route, Routes } from 'react-router-dom';

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
      <Route path="/" element={<HomePage />} />
    </Routes>
  );
}
