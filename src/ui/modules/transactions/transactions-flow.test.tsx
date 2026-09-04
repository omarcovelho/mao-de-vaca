import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../../components/app-shell';
import { RequiresOrigins } from '../../components/requires-origins';
import { AuthProvider } from '../auth/auth-context';
import { ProtectedRoute } from '../auth/protected-route';
import { SetupStatusProvider } from '../accounts/setup-status-context';
import { RegimeProvider } from './regime-context';
import { monthBounds, toMonthKey } from './month';
import { TransactionsPage } from './transactions-page';

function renderTransactionsApp(initialPath = '/lancamentos') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <SetupStatusProvider>
          <RegimeProvider>
            <Routes>
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route element={<RequiresOrigins />}>
                    <Route path="/lancamentos" element={<TransactionsPage />} />
                  </Route>
                </Route>
              </Route>
            </Routes>
          </RegimeProvider>
        </SetupStatusProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const setupOk = {
  hasAccounts: true,
  hasCards: false,
  hasCategories: true,
  readyForImport: true,
};

const foodLeaf = {
  id: 'food',
  parentId: null,
  name: 'Alimentação',
  kind: 'EXPENSE',
  color: '#2d6a4f',
  icon: 'utensils',
  active: true,
  depth: 1,
  isLeaf: true,
  children: [],
};

const leisureLeaf = {
  id: 'leisure',
  parentId: null,
  name: 'Lazer',
  kind: 'EXPENSE',
  color: '#40916c',
  icon: 'sparkles',
  active: true,
  depth: 1,
  isLeaf: true,
  children: [],
};

describe('Transactions UI flow', () => {
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

  it('lists month transactions and sends regime/from/to on toggle', async () => {
    const user = userEvent.setup();
    const month = toMonthKey();
    const bounds = monthBounds(month);
    const listCalls: string[] = [];

    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Response.json({ id: 'u1', username: 'mao' });
      }
      if (url.includes('/api/setup/status')) {
        return Response.json(setupOk);
      }
      if (url.includes('/api/accounts')) {
        return Response.json([
          {
            id: 'acc-1',
            label: 'Nubank CC',
            bank: { id: 'b1', name: 'Nubank' },
            active: true,
          },
        ]);
      }
      if (url.includes('/api/categories')) {
        return Response.json([foodLeaf, leisureLeaf]);
      }
      if (url.includes('/api/transactions') && !url.includes('/api/transactions/')) {
        listCalls.push(url);
        return Response.json({
          regime: url.includes('regime=cash') ? 'cash' : 'competence',
          from: bounds.from,
          to: bounds.to,
          items: [
            {
              id: 'tx-1',
              description: 'Supermercado',
              amount: 120.5,
              type: 'EXPENSE',
              competenceDate: `${month}-15`,
              cashDate: `${month}-15`,
              displayDate: `${month}-15`,
              active: true,
              category: {
                id: 'food',
                name: 'Alimentação',
                color: '#2d6a4f',
                icon: 'utensils',
                kind: 'EXPENSE',
              },
              account: { id: 'acc-1', label: 'Nubank CC', bank: { id: 'b1', name: 'Nubank' } },
              card: null,
              invoiceId: null,
            },
          ],
        });
      }
      return new Response(null, { status: 404 });
    });

    renderTransactionsApp();

    expect(await screen.findByText('Supermercado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alimentação' })).toBeInTheDocument();
    const row = screen.getByText('Supermercado').closest('li');
    expect(row).toHaveTextContent('Nubank CC');
    expect(row).toHaveTextContent('Nubank');
    expect(within(row!).getByRole('img', { name: 'Conta' })).toBeInTheDocument();
    expect(listCalls[0]).toContain(`from=${bounds.from}`);
    expect(listCalls[0]).toContain(`to=${bounds.to}`);
    expect(listCalls[0]).toContain('regime=competence');

    await user.click(screen.getByRole('button', { name: 'Caixa' }));

    await vi.waitFor(() => {
      expect(listCalls.at(-1)).toContain('regime=cash');
    });
  });

  it('changes category inline and can deactivate a row', async () => {
    const user = userEvent.setup();
    const month = toMonthKey();
    const bounds = monthBounds(month);
    let items = [
      {
        id: 'tx-1',
        description: 'Cinema',
        amount: 40,
        type: 'EXPENSE' as const,
        competenceDate: `${month}-10`,
        cashDate: `${month}-10`,
        displayDate: `${month}-10`,
        active: true,
        category: {
          id: 'food',
          name: 'Alimentação',
          color: '#2d6a4f',
          icon: 'utensils',
          kind: 'EXPENSE' as const,
        },
        account: { id: 'acc-1', label: 'Nubank CC', bank: { id: 'b1', name: 'Nubank' } },
        card: null,
        invoiceId: null,
      },
    ];

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Response.json({ id: 'u1', username: 'mao' });
      }
      if (url.includes('/api/setup/status')) {
        return Response.json(setupOk);
      }
      if (url.includes('/api/accounts')) {
        return Response.json([
          {
            id: 'acc-1',
            label: 'Nubank CC',
            bank: { id: 'b1', name: 'Nubank' },
            active: true,
          },
        ]);
      }
      if (url.includes('/api/categories')) {
        return Response.json([foodLeaf, leisureLeaf]);
      }
      if (url.includes('/api/transactions/tx-1') && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as {
          categoryId?: string;
          active?: boolean;
        };
        if (body.categoryId === 'leisure') {
          items = [
            {
              ...items[0],
              category: {
                id: 'leisure',
                name: 'Lazer',
                color: '#40916c',
                icon: 'sparkles',
                kind: 'EXPENSE',
              },
            },
          ];
          return Response.json(items[0]);
        }
        if (body.active === false) {
          const deactivated = { ...items[0], active: false };
          items = [];
          return Response.json(deactivated);
        }
      }
      if (url.includes('/api/transactions')) {
        return Response.json({
          regime: 'competence',
          from: bounds.from,
          to: bounds.to,
          items,
        });
      }
      return new Response(null, { status: 404 });
    });

    renderTransactionsApp();

    expect(await screen.findByText('Cinema')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Alimentação' }));

    const select = await screen.findByLabelText('Categoria de Cinema');
    await user.selectOptions(select, 'leisure');

    expect(await screen.findByRole('button', { name: 'Lazer' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Desativar' }));

    await vi.waitFor(() => {
      expect(screen.queryByText('Cinema')).not.toBeInTheDocument();
    });
  });

  it('applies optional account filter in the query string', async () => {
    const user = userEvent.setup();
    const month = toMonthKey();
    const bounds = monthBounds(month);
    const listCalls: string[] = [];

    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Response.json({ id: 'u1', username: 'mao' });
      }
      if (url.includes('/api/setup/status')) {
        return Response.json(setupOk);
      }
      if (url.includes('/api/accounts')) {
        return Response.json([
          {
            id: 'acc-1',
            label: 'Nubank CC',
            bank: { id: 'b1', name: 'Nubank' },
            active: true,
          },
          {
            id: 'acc-2',
            label: 'Itaú',
            bank: { id: 'b2', name: 'Itaú' },
            active: true,
          },
        ]);
      }
      if (url.includes('/api/categories')) {
        return Response.json([foodLeaf]);
      }
      if (url.includes('/api/transactions')) {
        listCalls.push(url);
        return Response.json({
          regime: 'competence',
          from: bounds.from,
          to: bounds.to,
          items: [],
        });
      }
      return new Response(null, { status: 404 });
    });

    renderTransactionsApp();

    expect(
      await screen.findByText('Nenhum lançamento neste período.'),
    ).toBeInTheDocument();

    const accountSelect = screen.getByLabelText('Conta');
    await user.selectOptions(accountSelect, 'acc-2');

    await vi.waitFor(() => {
      expect(listCalls.at(-1)).toContain('accountId=acc-2');
    });
    expect(listCalls[0]).not.toContain('accountId=');
  });

  it('shows Cartão origin for card purchases', async () => {
    const month = toMonthKey();
    const bounds = monthBounds(month);

    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Response.json({ id: 'u1', username: 'mao' });
      }
      if (url.includes('/api/setup/status')) {
        return Response.json(setupOk);
      }
      if (url.includes('/api/accounts')) {
        return Response.json([]);
      }
      if (url.includes('/api/categories')) {
        return Response.json([foodLeaf]);
      }
      if (url.includes('/api/transactions')) {
        return Response.json({
          regime: 'competence',
          from: bounds.from,
          to: bounds.to,
          items: [
            {
              id: 'tx-card',
              description: 'Pao de Acucar',
              amount: -120,
              type: 'EXPENSE',
              competenceDate: `${month}-15`,
              cashDate: null,
              displayDate: `${month}-15`,
              active: true,
              category: {
                id: 'food',
                name: 'Alimentação',
                color: '#2d6a4f',
                icon: 'utensils',
                kind: 'EXPENSE',
              },
              account: null,
              card: {
                id: 'card-1',
                label: 'Nubank Roxinho',
                bank: { id: 'b1', name: 'Nubank' },
              },
              invoiceId: 'inv-1',
            },
          ],
        });
      }
      return new Response(null, { status: 404 });
    });

    renderTransactionsApp();

    expect(await screen.findByText('Pao de Acucar')).toBeInTheDocument();
    const row = screen.getByText('Pao de Acucar').closest('li');
    expect(row).toHaveTextContent('Nubank Roxinho');
    expect(row).toHaveTextContent('Nubank');
    expect(within(row!).getByRole('img', { name: 'Cartão' })).toBeInTheDocument();
    expect(within(row!).getByRole('link')).toHaveAttribute(
      'href',
      '/cartoes?invoiceId=inv-1',
    );
  });

  it('links invoice payment account origin to the invoice detail', async () => {
    const month = toMonthKey();

    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Response.json({ id: 'u1', username: 'mao' });
      }
      if (url.includes('/api/setup/status')) {
        return Response.json(setupOk);
      }
      if (url.includes('/api/accounts')) {
        return Response.json([
          {
            id: 'acc-1',
            label: 'Conta Nubank',
            active: true,
            bank: { id: 'b1', name: 'Nubank' },
          },
        ]);
      }
      if (url.includes('/api/categories')) {
        return Response.json([foodLeaf]);
      }
      if (url.includes('/api/transactions?')) {
        return Response.json({
          regime: 'competence',
          from: `${month}-01`,
          to: `${month}-28`,
          items: [
            {
              id: 'pay-1',
              description: 'Pagamento fatura',
              amount: -500,
              type: 'INVOICE_PAYMENT',
              competenceDate: `${month}-10`,
              cashDate: `${month}-10`,
              displayDate: `${month}-10`,
              active: true,
              category: {
                id: 'food',
                name: 'Alimentação',
                color: '#2d6a4f',
                icon: 'utensils',
                kind: 'EXPENSE',
              },
              account: {
                id: 'acc-1',
                label: 'Conta Nubank',
                bank: { id: 'b1', name: 'Nubank' },
              },
              card: null,
              invoiceId: 'inv-1',
            },
          ],
        });
      }
      return new Response(null, { status: 404 });
    });

    renderTransactionsApp();

    expect(await screen.findByText('Pagamento fatura')).toBeInTheDocument();
    const row = screen.getByText('Pagamento fatura').closest('li');
    expect(within(row!).getByRole('link')).toHaveAttribute(
      'href',
      '/cartoes?invoiceId=inv-1',
    );
  });
});
