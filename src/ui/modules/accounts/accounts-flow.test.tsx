import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/auth-context';
import { LoginPage } from '../auth/login-page';
import { ProtectedRoute } from '../auth/protected-route';
import { AppShell } from '../../components/app-shell';
import { ToastProvider } from '../../components/toast';
import { RegimeProvider } from '../transactions/regime-context';
import { chooseSearchableOption } from '../../test/searchable-select-helpers';
import { AccountsPage } from './accounts-page';
import { CardsPage } from './cards-page';
import { HomePage } from './home-page';
import { SetupStatusProvider } from './setup-status-context';

function renderApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ToastProvider>
        <AuthProvider>
          <SetupStatusProvider>
            <RegimeProvider>
              <Routes>
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppShell />}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/contas" element={<AccountsPage />} />
                    <Route path="/cartoes" element={<CardsPage />} />
                  </Route>
                </Route>
              </Routes>
            </RegimeProvider>
          </SetupStatusProvider>
        </AuthProvider>
      </ToastProvider>
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

  it('shows setup CTA when there are no accounts or cards', async () => {
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
      await screen.findByRole('heading', { name: 'Vamos começar' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Conta' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cartão' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /setembro de 2026/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Navegação principal' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Finalizar configuração' }),
    ).not.toBeInTheDocument();
  });

  it('shows dashboard when at least one account exists', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Response.json({ id: 'u1', username: 'mao' });
      }
      if (url.includes('/api/setup/status')) {
        return Response.json({
          hasAccounts: true,
          hasCards: false,
          hasCategories: false,
          readyForImport: false,
        });
      }
      return new Response(null, { status: 404 });
    });

    renderApp('/');

    expect(
      await screen.findByRole('heading', { name: /setembro de 2026/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Vamos começar' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Navegação principal' })).toBeInTheDocument();
  });

  it('shows onboarding for a user without origins even if a prior session finalized', async () => {
    sessionStorage.setItem('mdv_onboarding_finalized', '1');

    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Response.json({ id: 'u2', username: 'marco' });
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
      await screen.findByRole('heading', { name: 'Vamos começar' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', { name: 'Navegação principal' }),
    ).not.toBeInTheDocument();
    expect(sessionStorage.getItem('mdv_onboarding_finalized')).toBeNull();
  });

  it('shows onboarding after logout from a configured user and login as empty user', async () => {
    const user = userEvent.setup();
    let currentUser: { id: string; username: string } | null = {
      id: 'u1',
      username: 'mao',
    };

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        if (!currentUser) {
          return new Response(null, { status: 401 });
        }
        return Response.json(currentUser);
      }
      if (url.includes('/api/auth/logout') && init?.method === 'POST') {
        currentUser = null;
        return new Response(null, { status: 204 });
      }
      if (url.includes('/api/auth/login') && init?.method === 'POST') {
        currentUser = { id: 'u2', username: 'marco' };
        return Response.json(currentUser);
      }
      if (url.includes('/api/setup/status')) {
        if (currentUser?.username === 'mao') {
          return Response.json({
            hasAccounts: true,
            hasCards: true,
            hasCategories: false,
            readyForImport: true,
          });
        }
        return Response.json({
          hasAccounts: false,
          hasCards: false,
          hasCategories: false,
          readyForImport: false,
        });
      }
      return new Response(null, { status: 404 });
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <ToastProvider>
          <AuthProvider>
            <SetupStatusProvider>
              <RegimeProvider>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route element={<ProtectedRoute />}>
                    <Route element={<AppShell />}>
                      <Route path="/" element={<HomePage />} />
                    </Route>
                  </Route>
                </Routes>
              </RegimeProvider>
            </SetupStatusProvider>
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: /setembro de 2026/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sair' }));
    await screen.findByRole('heading', { name: 'Entrar' });

    await user.type(screen.getByLabelText('Usuário'), 'marco');
    await user.type(screen.getByLabelText('Senha'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByRole('heading', { name: 'Vamos começar' }),
    ).toBeInTheDocument();
  });

  it('lets user switch between account and card setup', async () => {
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
      if (url.includes('/api/banks')) {
        return Response.json([{ id: 'b1', name: 'Nubank' }]);
      }
      if (url.includes('/api/accounts')) {
        return Response.json([]);
      }
      if (url.includes('/api/cards')) {
        return Response.json([]);
      }
      return new Response(null, { status: 404 });
    });

    renderApp('/contas');

    expect(
      await screen.findByRole('link', { name: 'Conta' }),
    ).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getByRole('link', { name: 'Cartão' }));

    expect(
      await screen.findByRole('heading', { name: 'Novo cartão' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cartão' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows continue options after creating account during onboarding', async () => {
    const user = userEvent.setup();
    let banks = [
      { id: 'b1', name: 'Nubank' },
      { id: 'b2', name: 'Itaú' },
    ];
    let hasAccounts = false;
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
      if (url.includes('/api/setup/status')) {
        return Response.json({
          hasAccounts,
          hasCards: false,
          hasCategories: false,
          readyForImport: false,
        });
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
        hasAccounts = true;
        return Response.json(created, { status: 201 });
      }
      if (url.includes('/api/accounts') && !init?.method) {
        return Response.json(accounts);
      }
      if (url.includes('/api/cards')) {
        return Response.json([]);
      }
      return new Response(null, { status: 404 });
    });

    renderApp('/contas');

    await screen.findByRole('heading', { name: 'Nova conta' });
    expect(
      screen.queryByRole('button', { name: 'Finalizar configuração' }),
    ).not.toBeInTheDocument();
    await screen.findByRole('combobox', { name: 'Banco' });
    await user.type(screen.getByLabelText('Apelido'), 'Nubank CC');
    await chooseSearchableOption(user, 'Banco', 'Nubank');
    await user.click(screen.getByRole('button', { name: 'Adicionar conta' }));

    expect(
      await screen.findByText('Conta cadastrada com sucesso!'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Adicionar outra conta' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Adicionar cartão' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Finalizar configuração' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Cadastrados' }),
    ).toBeInTheDocument();
    const originsList = screen.getByRole('heading', { name: 'Cadastrados' })
      .parentElement as HTMLElement;
    expect(within(originsList).getByText('Nubank CC')).toBeInTheDocument();
    expect(within(originsList).getByText('Conta')).toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', { name: 'Navegação principal' }),
    ).not.toBeInTheDocument();
  });

  it('shows full app only after finalizing onboarding', async () => {
    const user = userEvent.setup();
    let hasAccounts = false;

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Response.json({ id: 'u1', username: 'mao' });
      }
      if (url.includes('/api/setup/status')) {
        return Response.json({
          hasAccounts,
          hasCards: false,
          hasCategories: false,
          readyForImport: false,
        });
      }
      if (url.includes('/api/banks')) {
        return Response.json([{ id: 'b1', name: 'Nubank' }]);
      }
      if (url.includes('/api/accounts') && init?.method === 'POST') {
        hasAccounts = true;
        return Response.json(
          {
            id: 'a1',
            label: 'Nubank CC',
            bankId: 'b1',
            bank: { id: 'b1', name: 'Nubank' },
            active: true,
          },
          { status: 201 },
        );
      }
      if (url.includes('/api/accounts')) {
        return Response.json(
          hasAccounts
            ? [
                {
                  id: 'a1',
                  label: 'Nubank CC',
                  bankId: 'b1',
                  bank: { id: 'b1', name: 'Nubank' },
                  active: true,
                },
              ]
            : [],
        );
      }
      if (url.includes('/api/cards')) {
        return Response.json([]);
      }
      return new Response(null, { status: 404 });
    });

    renderApp('/contas');

    await screen.findByRole('heading', { name: 'Nova conta' });
    await user.type(screen.getByLabelText('Apelido'), 'Nubank CC');
    await chooseSearchableOption(user, 'Banco', 'Nubank');
    await user.click(screen.getByRole('button', { name: 'Adicionar conta' }));

    await screen.findByText('Conta cadastrada com sucesso!');
    await user.click(
      screen.getByRole('button', { name: 'Finalizar configuração' }),
    );

    expect(
      await screen.findByRole('heading', { name: /setembro de 2026/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('complementary', { name: 'Navegação principal' }),
    ).toBeInTheDocument();
  });

  it('creates an account with selected bank and shows it in the list after onboarding', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem('mdv_onboarding_finalized', '1');
    let banks = [
      { id: 'b1', name: 'Nubank' },
      { id: 'b2', name: 'Itaú' },
    ];
    let hasAccounts = true;
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
      if (url.includes('/api/setup/status')) {
        return Response.json({
          hasAccounts,
          hasCards: false,
          hasCategories: false,
          readyForImport: false,
        });
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
        hasAccounts = true;
        return Response.json(created, { status: 201 });
      }
      if (url.includes('/api/accounts') && !init?.method) {
        return Response.json(accounts);
      }
      return new Response(null, { status: 404 });
    });

    renderApp('/contas');

    await screen.findByRole('heading', { name: 'Contas' });
    await user.click(screen.getByRole('button', { name: 'Adicionar conta' }));
    await screen.findByRole('heading', { name: 'Nova conta' });
    await user.type(screen.getByLabelText('Apelido'), 'Nubank CC');
    await chooseSearchableOption(user, 'Banco', 'Nubank');
    await user.click(screen.getByRole('button', { name: 'Adicionar conta' }));

    await waitFor(() => {
      expect(screen.getByText(/Nubank CC/)).toBeInTheDocument();
    });
    expect(screen.getByRole('list')).toHaveTextContent('Nubank');
  });

  it('shows continue options after creating card during onboarding', async () => {
    const user = userEvent.setup();
    let banks = [{ id: 'b1', name: 'Nubank' }];
    let hasCards = false;
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
      if (url.includes('/api/setup/status')) {
        return Response.json({
          hasAccounts: false,
          hasCards,
          hasCategories: false,
          readyForImport: false,
        });
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
        hasCards = true;
        return Response.json(created, { status: 201 });
      }
      if (url.includes('/invoices')) {
        return Response.json([]);
      }
      if (url.includes('/api/cards') && !init?.method) {
        return Response.json(cards);
      }
      if (url.includes('/api/accounts')) {
        return Response.json([]);
      }
      return new Response(null, { status: 404 });
    });

    renderApp('/cartoes');

    await screen.findByRole('heading', { name: 'Novo cartão' });
    await screen.findByRole('combobox', { name: 'Banco' });

    await user.click(screen.getByRole('button', { name: 'Cadastrar novo banco' }));
    await user.type(screen.getByPlaceholderText('Nome do banco'), 'Bradesco');
    await user.click(screen.getByRole('button', { name: 'Cadastrar banco' }));

    await waitFor(async () => {
      await user.click(screen.getByRole('combobox', { name: 'Banco' }));
      expect(screen.getByRole('option', { name: 'Bradesco' })).toBeInTheDocument();
    });
    await user.keyboard('{Escape}');

    await user.type(screen.getByLabelText('Apelido'), 'Visa Bradesco');
    await user.click(screen.getByRole('button', { name: 'Adicionar cartão' }));

    expect(
      await screen.findByText('Cartão cadastrado com sucesso!'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Adicionar outro cartão' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Adicionar conta' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Finalizar configuração' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Cadastrados' }),
    ).toBeInTheDocument();
    const originsList = screen.getByRole('heading', { name: 'Cadastrados' })
      .parentElement as HTMLElement;
    expect(within(originsList).getByText('Visa Bradesco')).toBeInTheDocument();
    expect(within(originsList).getByText('Cartão')).toBeInTheDocument();
  });

  it('registers a new bank and uses it when creating a card after onboarding', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem('mdv_onboarding_finalized', '1');
    let banks = [{ id: 'b1', name: 'Nubank' }];
    let hasCards = true;
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
      if (url.includes('/api/setup/status')) {
        return Response.json({
          hasAccounts: false,
          hasCards,
          hasCategories: false,
          readyForImport: false,
        });
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
        hasCards = true;
        return Response.json(created, { status: 201 });
      }
      if (url.includes('/invoices')) {
        return Response.json([]);
      }
      if (url.includes('/api/cards') && !init?.method) {
        return Response.json(cards);
      }
      return new Response(null, { status: 404 });
    });

    renderApp('/cartoes');

    await screen.findByRole('heading', { name: 'Cartões' });
    await user.click(screen.getByRole('button', { name: 'Adicionar cartão' }));
    await screen.findByRole('heading', { name: 'Novo cartão' });
    await screen.findByRole('combobox', { name: 'Banco' });

    await user.click(screen.getByRole('button', { name: 'Cadastrar novo banco' }));
    await user.type(screen.getByPlaceholderText('Nome do banco'), 'Bradesco');
    await user.click(screen.getByRole('button', { name: 'Cadastrar banco' }));

    await waitFor(async () => {
      await user.click(screen.getByRole('combobox', { name: 'Banco' }));
      expect(screen.getByRole('option', { name: 'Bradesco' })).toBeInTheDocument();
    });
    await user.keyboard('{Escape}');

    await user.type(screen.getByLabelText('Apelido'), 'Visa Bradesco');
    await user.click(screen.getByRole('button', { name: 'Adicionar cartão' }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Visa Bradesco', pressed: true }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: /Faturas · Visa Bradesco/i })).toBeInTheDocument();
  });
});
