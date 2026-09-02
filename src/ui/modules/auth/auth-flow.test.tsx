import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './auth-context';
import { useAuth } from './use-auth';
import { LoginPage } from './login-page';
import { ProtectedRoute } from './protected-route';
import * as authApi from './api';

function HomePage() {
  const { logout } = useAuth();
  return (
    <div>
      <h1>Bem-vindo</h1>
      <button type="button" onClick={() => void logout()}>
        Sair
      </button>
    </div>
  );
}

function renderApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomePage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Auth UI flow', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('redirects unauthenticated users from / to /login', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));

    renderApp('/');

    expect(
      await screen.findByRole('heading', { name: 'Entrar' }),
    ).toBeInTheDocument();
  });

  it('logs in and navigates to home', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return new Response(null, { status: 401 });
      }
      if (url.includes('/api/auth/login') && init?.method === 'POST') {
        return Response.json({ id: 'u1', username: 'mao' });
      }
      return new Response(null, { status: 404 });
    });

    renderApp('/login');

    await screen.findByLabelText('Usuário');
    await user.type(screen.getByLabelText('Usuário'), 'mao');
    await user.type(screen.getByLabelText('Senha'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByRole('heading', { name: 'Bem-vindo' }),
    ).toBeInTheDocument();
  });

  it('clears session and redirects to login on 401 (expired token)', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Response.json({ id: 'u1', username: 'mao' });
      }
      return new Response(null, { status: 404 });
    });

    renderApp('/');

    expect(
      await screen.findByRole('heading', { name: 'Bem-vindo' }),
    ).toBeInTheDocument();

    vi.mocked(fetch).mockImplementation(async () => new Response(null, { status: 401 }));

    await authApi.me();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    });
  });
});
