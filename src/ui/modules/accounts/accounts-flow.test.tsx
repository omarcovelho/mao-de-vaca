import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/auth-context';
import { ProtectedRoute } from '../auth/protected-route';
import { AccountsPage } from './accounts-page';
import { CardsPage } from './cards-page';
import { HomePage } from './home-page';

function renderApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
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
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Accounts UI flow', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('shows skippable onboarding when setup is empty', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Response.json({ id: 'u1', username: 'mao' });
      }
      if (url.includes('/api/setup/status')) {
        return Response.json({
          hasAccounts: false,
          hasCards: false,
          hasCategories: false,
          readyForImport: false,
        });
      }
      return new Response(null, { status: 404 });
    });

    renderApp('/');

    expect(
      await screen.findByRole('heading', {
        name: 'Cadastre suas contas e cartões',
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pular' }));

    expect(
      await screen.findByRole('heading', { name: 'Bem-vindo' }),
    ).toBeInTheDocument();
  });

  it('creates an account with selected bank and shows it in the list', async () => {
    const user = userEvent.setup();
    let banks = [
      { id: 'b1', name: 'Nubank' },
      { id: 'b2', name: 'Itaú' },
    ];
    let accounts: Array<{
      id: string;
      label: string;
      bankId: string;
      bank: { id: string; name: string };
      active: boolean;
    }> = [];

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Response.json({ id: 'u1', username: 'mao' });
      }
      if (url.includes('/api/banks') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { name: string };
        const created = { id: `b-${banks.length + 1}`, name: body.name };
        banks = [...banks, created];
        return Response.json(created, { status: 201 });
      }
      if (url.includes('/api/banks')) {
        return Response.json(banks);
      }
      if (url.includes('/api/accounts') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as {
          label: string;
          bankId: string;
        };
        const bank = banks.find((item) => item.id === body.bankId)!;
        const created = {
          id: 'a1',
          label: body.label,
          bankId: body.bankId,
          bank,
          active: true,
        };
        accounts = [...accounts, created];
        return Response.json(created, { status: 201 });
      }
      if (url.includes('/api/accounts') && !init?.method) {
        return Response.json(accounts);
      }
      return new Response(null, { status: 404 });
    });

    renderApp('/contas');

    await screen.findByRole('heading', { name: 'Contas' });
    await screen.findByRole('combobox', { name: 'Banco' });
    await user.type(screen.getByLabelText('Apelido'), 'Nubank CC');
    await user.selectOptions(screen.getByLabelText('Banco'), 'b1');
    await user.click(screen.getByRole('button', { name: 'Adicionar conta' }));

    await waitFor(() => {
      expect(screen.getByText(/Nubank CC/)).toBeInTheDocument();
    });
    expect(screen.getByRole('list')).toHaveTextContent('Nubank');
  });

  it('registers a new bank and uses it when creating a card', async () => {
    const user = userEvent.setup();
    let banks = [{ id: 'b1', name: 'Nubank' }];
    let cards: Array<{
      id: string;
      label: string;
      bankId: string;
      bank: { id: string; name: string };
      active: boolean;
    }> = [];

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Response.json({ id: 'u1', username: 'mao' });
      }
      if (url.includes('/api/banks') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { name: string };
        const created = { id: 'b-new', name: body.name };
        banks = [...banks, created];
        return Response.json(created, { status: 201 });
      }
      if (url.includes('/api/banks')) {
        return Response.json(banks);
      }
      if (url.includes('/api/cards') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as {
          label: string;
          bankId: string;
        };
        const bank = banks.find((item) => item.id === body.bankId)!;
        const created = {
          id: 'c1',
          label: body.label,
          bankId: body.bankId,
          bank,
          active: true,
        };
        cards = [...cards, created];
        return Response.json(created, { status: 201 });
      }
      if (url.includes('/api/cards') && !init?.method) {
        return Response.json(cards);
      }
      return new Response(null, { status: 404 });
    });

    renderApp('/cartoes');

    await screen.findByRole('heading', { name: 'Cartões' });
    await screen.findByLabelText('Banco');

    await user.type(screen.getByPlaceholderText('Nome do banco'), 'Bradesco');
    await user.click(screen.getByRole('button', { name: 'Cadastrar banco' }));

    await waitFor(() => {
      expect(
        within(screen.getByLabelText('Banco')).getByRole('option', {
          name: 'Bradesco',
        }),
      ).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('Apelido'), 'Visa Bradesco');
    await user.click(screen.getByRole('button', { name: 'Adicionar cartão' }));

    await waitFor(() => {
      expect(screen.getByText(/Visa Bradesco/)).toBeInTheDocument();
    });
    expect(screen.getByRole('list')).toHaveTextContent('Bradesco');
  });
});
