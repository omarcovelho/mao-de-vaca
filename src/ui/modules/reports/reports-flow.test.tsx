import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../../components/app-shell';
import { RequiresOrigins } from '../../components/requires-origins';
import { ToastProvider } from '../../components/toast';
import { AuthProvider } from '../auth/auth-context';
import { ProtectedRoute } from '../auth/protected-route';
import { SetupStatusProvider } from '../accounts/setup-status-context';
import { HomePage } from '../accounts/home-page';
import { RegimeProvider } from '../transactions/regime-context';
import { monthBounds, shiftMonth, toMonthKey, formatMonthLabel } from '../transactions/month';
import { TransactionsPage } from '../transactions/transactions-page';
import { ReportsPage } from './reports-page';

function renderReportsApp(initialPath = '/relatorios') {
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
                    <Route element={<RequiresOrigins />}>
                      <Route path="/relatorios" element={<ReportsPage />} />
                      <Route path="/lancamentos" element={<TransactionsPage />} />
                    </Route>
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

const setupOk = {
  hasAccounts: true,
  hasCards: false,
  hasCategories: true,
  readyForImport: true,
};

describe('Reports UI flow', () => {
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

  it('shows summary, categories and monthly evolution on /relatorios', async () => {
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
      if (url.includes('/api/reports/summary')) {
        return Response.json({
          regime: 'competence',
          from: bounds.from,
          to: bounds.to,
          expenseTotal: 150,
          incomeTotal: 2000,
          balance: 1850,
        });
      }
      if (url.includes('/api/reports/by-category')) {
        return Response.json({
          regime: 'competence',
          from: bounds.from,
          to: bounds.to,
          items: [
            {
              categoryId: 'food',
              name: 'Alimentação',
              color: '#2d6a4f',
              icon: 'utensils',
              total: 100,
              percent: 66.7,
              children: [],
            },
            {
              categoryId: 'leisure',
              name: 'Lazer',
              color: '#40916c',
              icon: 'sparkles',
              total: 50,
              percent: 33.3,
              children: [],
            },
          ],
        });
      }
      if (url.includes('/api/reports/monthly-evolution')) {
        return Response.json({
          regime: 'competence',
          months: 6,
          endMonth: month,
          items: [
            { month: '2026-04', expenseTotal: 0, incomeTotal: 0 },
            { month: '2026-05', expenseTotal: 0, incomeTotal: 0 },
            { month: '2026-06', expenseTotal: 0, incomeTotal: 0 },
            { month: '2026-07', expenseTotal: 0, incomeTotal: 0 },
            { month: '2026-08', expenseTotal: 80, incomeTotal: 0 },
            { month: month, expenseTotal: 150, incomeTotal: 2000 },
          ],
        });
      }
      return new Response(null, { status: 404 });
    });

    renderReportsApp('/relatorios');

    expect(
      await screen.findByRole('heading', { name: 'Relatórios' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Gastos do mês')).toBeInTheDocument();
    expect(screen.getByText('R$ 150,00')).toBeInTheDocument();
    expect(screen.getByText('Receitas')).toBeInTheDocument();
    expect(screen.getByText('R$ 2.000,00')).toBeInTheDocument();
    expect(screen.getAllByText('Alimentação').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Lazer')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Evolução mensal de gastos' }),
    ).toBeInTheDocument();

    const summaryCalls = vi
      .mocked(fetch)
      .mock.calls.map(([input]) => String(input))
      .filter((url) => url.includes('/api/reports/summary'));
    expect(summaryCalls.some((url) => url.includes(`from=${bounds.from}`))).toBe(
      true,
    );
    expect(summaryCalls.some((url) => url.includes('regime=competence'))).toBe(
      true,
    );

    const evolutionCalls = vi
      .mocked(fetch)
      .mock.calls.map(([input]) => String(input))
      .filter((url) => url.includes('/api/reports/monthly-evolution'));
    expect(evolutionCalls.some((url) => url.includes('months=6'))).toBe(true);
    expect(evolutionCalls.some((url) => url.includes(`endMonth=${month}`))).toBe(
      true,
    );
  });

  it('refetches reports when regime toggle changes', async () => {
    const user = userEvent.setup();
    const month = toMonthKey();
    const bounds = monthBounds(month);
    const regimes: string[] = [];

    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Response.json({ id: 'u1', username: 'mao' });
      }
      if (url.includes('/api/setup/status')) {
        return Response.json(setupOk);
      }
      if (url.includes('/api/reports/')) {
        const regime = new URL(url, 'http://local').searchParams.get('regime');
        if (regime) {
          regimes.push(`${url.includes('summary') ? 'summary' : 'other'}:${regime}`);
        }
        if (url.includes('/api/reports/summary')) {
          return Response.json({
            regime,
            from: bounds.from,
            to: bounds.to,
            expenseTotal: regime === 'cash' ? 40 : 150,
            incomeTotal: 0,
            balance: regime === 'cash' ? -40 : -150,
          });
        }
        if (url.includes('/api/reports/by-category')) {
          return Response.json({
            regime,
            from: bounds.from,
            to: bounds.to,
            items: [],
          });
        }
        return Response.json({
          regime,
          months: 6,
          endMonth: month,
          items: [],
        });
      }
      return new Response(null, { status: 404 });
    });

    renderReportsApp('/relatorios');

    expect(await screen.findByText('R$ 150,00')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Caixa' }));

    await waitFor(() => {
      expect(screen.getByText('R$ 40,00')).toBeInTheDocument();
    });
    expect(regimes.some((entry) => entry === 'summary:cash')).toBe(true);
  });

  it('home shows expense hero and top categories from reports API', async () => {
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
      if (url.includes('/api/transactions?')) {
        return Response.json({
          regime: 'competence',
          from: bounds.from,
          to: bounds.to,
          items: [
            {
              id: 't1',
              description: 'Mercado',
              amount: -80,
              type: 'EXPENSE',
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

              systemKey: null,
              },
              account: {
                id: 'a1',
                label: 'Conta',
                bank: { id: 'b1', name: 'Nubank' },
              },
              card: null,
              invoiceId: null,
            transferCounterpartId: null,
            },
          ],
        });
      }
      if (url.includes('/api/reports/summary')) {
        return Response.json({
          regime: 'competence',
          from: bounds.from,
          to: bounds.to,
          expenseTotal: 120,
          incomeTotal: 0,
          balance: -120,
        });
      }
      if (url.includes('/api/reports/by-category')) {
        return Response.json({
          regime: 'competence',
          from: bounds.from,
          to: bounds.to,
          items: [
            {
              categoryId: 'food',
              name: 'Alimentação',
              color: '#2d6a4f',
              icon: 'utensils',
              total: 80,
              percent: 66.7,
              children: [],
            },
            {
              categoryId: 'leisure',
              name: 'Lazer',
              color: '#40916c',
              icon: 'sparkles',
              total: 40,
              percent: 33.3,
              children: [],
            },
          ],
        });
      }
      return new Response(null, { status: 404 });
    });

    renderReportsApp('/');

    expect(await screen.findByText('R$ 120,00')).toBeInTheDocument();
    expect(screen.getAllByText('Alimentação').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Lazer')).toBeInTheDocument();
    expect(screen.getByText('Mercado')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ver relatórios' }),
    ).toBeInTheDocument();
  });

  it('expands parent category to reveal children totals', async () => {
    const user = userEvent.setup();
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
      if (url.includes('/api/reports/summary')) {
        return Response.json({
          regime: 'competence',
          from: bounds.from,
          to: bounds.to,
          expenseTotal: 1200,
          incomeTotal: 0,
          balance: -1200,
        });
      }
      if (url.includes('/api/reports/by-category')) {
        return Response.json({
          regime: 'competence',
          from: bounds.from,
          to: bounds.to,
          items: [
            {
              categoryId: 'housing',
              name: 'Moradia',
              color: '#1b4332',
              icon: 'home',
              total: 1200,
              percent: 100,
              children: [
                {
                  categoryId: 'rent',
                  name: 'Aluguel',
                  color: '#2d6a4f',
                  icon: 'home',
                  total: 1000,
                  percent: 83.3,
                  children: [],
                },
                {
                  categoryId: 'utilities',
                  name: 'Contas',
                  color: '#40916c',
                  icon: 'zap',
                  total: 200,
                  percent: 16.7,
                  children: [],
                },
              ],
            },
          ],
        });
      }
      if (url.includes('/api/reports/monthly-evolution')) {
        return Response.json({
          regime: 'competence',
          months: 6,
          endMonth: month,
          items: [],
        });
      }
      return new Response(null, { status: 404 });
    });

    renderReportsApp('/relatorios');

    const expand = await screen.findByRole('button', {
      name: 'Expandir Moradia',
    });
    expect(screen.queryByText('Aluguel')).not.toBeInTheDocument();

    await user.click(expand);

    expect(await screen.findByText('Aluguel')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.000,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 200,00')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Recolher Moradia' }),
    ).toBeInTheDocument();

    const leafLink = screen.getByRole('link', { name: 'Aluguel' });
    expect(leafLink.getAttribute('href')).toBe(
      `/lancamentos?month=${month}&categoryId=rent`,
    );
  });

  it('changing month reloads summary and category breakdown for that period', async () => {
    const user = userEvent.setup();
    const current = toMonthKey();
    const previous = shiftMonth(current, -1);
    const currentBounds = monthBounds(current);
    const previousBounds = monthBounds(previous);
    const summaryFromParams: string[] = [];

    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Response.json({ id: 'u1', username: 'mao' });
      }
      if (url.includes('/api/setup/status')) {
        return Response.json(setupOk);
      }
      if (url.includes('/api/reports/summary')) {
        const from = new URL(url, 'http://local').searchParams.get('from') ?? '';
        summaryFromParams.push(from);
        const isPrevious = from === previousBounds.from;
        return Response.json({
          regime: 'competence',
          from,
          to: isPrevious ? previousBounds.to : currentBounds.to,
          expenseTotal: isPrevious ? 80 : 150,
          incomeTotal: 0,
          balance: isPrevious ? -80 : -150,
        });
      }
      if (url.includes('/api/reports/by-category')) {
        return Response.json({
          regime: 'competence',
          from: currentBounds.from,
          to: currentBounds.to,
          items: [],
        });
      }
      if (url.includes('/api/reports/monthly-evolution')) {
        return Response.json({
          regime: 'competence',
          months: 6,
          endMonth: current,
          items: [],
        });
      }
      return new Response(null, { status: 404 });
    });

    renderReportsApp('/relatorios');

    expect(await screen.findByText('R$ 150,00')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mês anterior' }));

    await waitFor(() => {
      expect(screen.getByText('R$ 80,00')).toBeInTheDocument();
    });
    expect(summaryFromParams).toContain(previousBounds.from);
  });

  it('leaf category link opens lançamentos with month and category filters', async () => {
    const user = userEvent.setup();
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
      if (url.includes('/api/reports/summary')) {
        return Response.json({
          regime: 'competence',
          from: bounds.from,
          to: bounds.to,
          expenseTotal: 100,
          incomeTotal: 0,
          balance: -100,
        });
      }
      if (url.includes('/api/reports/by-category')) {
        return Response.json({
          regime: 'competence',
          from: bounds.from,
          to: bounds.to,
          items: [
            {
              categoryId: 'food',
              name: 'Alimentação',
              color: '#2d6a4f',
              icon: 'utensils',
              total: 100,
              percent: 100,
              children: [],
            },
          ],
        });
      }
      if (url.includes('/api/reports/monthly-evolution')) {
        return Response.json({
          regime: 'competence',
          months: 6,
          endMonth: month,
          items: [],
        });
      }
      if (url.includes('/api/accounts')) {
        return Response.json([]);
      }
      if (url.includes('/api/categories')) {
        return Response.json([
          {
            id: 'food',
            parentId: null,
            name: 'Alimentação',
            kind: 'EXPENSE',
            systemKey: null,
            color: '#2d6a4f',
            icon: 'utensils',
            active: true,
            depth: 1,
            isLeaf: true,
            children: [],
          },
        ]);
      }
      if (url.includes('/api/transactions?')) {
        expect(url).toContain(`from=${bounds.from}`);
        expect(url).toContain(`to=${bounds.to}`);
        expect(url).toContain('categoryId=food');
        return Response.json({
          regime: 'competence',
          from: bounds.from,
          to: bounds.to,
          items: [],
        });
      }
      return new Response(null, { status: 404 });
    });

    renderReportsApp('/relatorios');

    const leaf = await screen.findByRole('link', { name: 'Alimentação' });
    expect(leaf).toHaveAttribute(
      'href',
      `/lancamentos?month=${month}&categoryId=food`,
    );

    await user.click(leaf);

    expect(
      await screen.findByRole('heading', { name: formatMonthLabel(month) }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole('combobox', { name: 'Filtro de categoria' }),
      ).toHaveTextContent('Alimentação');
    });
    expect(screen.getByLabelText('Selecionar mês')).toHaveValue(month);
  });
});
