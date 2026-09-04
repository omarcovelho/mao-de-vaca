import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../../components/app-shell';
import { RequiresOrigins } from '../../components/requires-origins';
import { AuthProvider } from '../auth/auth-context';
import { ProtectedRoute } from '../auth/protected-route';
import { HomePage } from '../accounts/home-page';
import { SetupStatusProvider } from '../accounts/setup-status-context';
import { AccountsPage } from '../accounts/accounts-page';
import { CardsPage } from '../accounts/cards-page';
import { RegimeProvider } from '../transactions/regime-context';
import { TransactionsPage } from '../transactions/transactions-page';
import { ImportPage } from './import-page';

function renderImportApp(initialPath = '/importar') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <SetupStatusProvider>
          <RegimeProvider>
            <Routes>
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/contas" element={<AccountsPage />} />
                  <Route path="/cartoes" element={<CardsPage />} />
                  <Route element={<RequiresOrigins />}>
                    <Route path="/importar" element={<ImportPage />} />
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
  hasCards: true,
  hasCategories: true,
  readyForImport: true,
};

const defaultOptions = {
  modes: [
    { id: 'transactions', label: 'Extrato de conta', enabled: true },
    { id: 'invoice', label: 'Fatura de cartão', enabled: true },
  ],
  parsers: [{ id: 'standard', label: 'Padrão' }],
  accounts: [
    {
      id: 'acc-1',
      label: 'Nubank CC',
      bank: { id: 'b1', name: 'Nubank' },
      active: true,
    },
  ],
  cards: [
    {
      id: 'card-1',
      label: 'Nubank Roxinho',
      bank: { id: 'b1', name: 'Nubank' },
      active: true,
    },
  ],
  invoicesByCard: {
    'card-1': [
      {
        id: 'inv-1',
        referenceMonth: '2026-08-01',
        dueDate: '2026-09-10',
        balance: 0,
        status: 'paid',
      },
    ],
  },
};

describe('Import UI flow', () => {
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

  it('previews unknown categories then confirms import counts', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Response.json({ id: 'u1', username: 'mao' });
      }
      if (url.includes('/api/setup/status')) {
        return Response.json(setupOk);
      }
      if (url.includes('/api/imports/options')) {
        return Response.json(defaultOptions);
      }
      if (url.endsWith('/api/imports') && (!init || init.method === undefined)) {
        return Response.json([]);
      }
      if (url.includes('/api/categories')) {
        return Response.json([
          {
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
          },
        ]);
      }
      if (url.includes('/api/imports/preview')) {
        return Response.json({
          rows: [
            {
              line: 2,
              description: 'Supermercado',
              amount: '-120.50',
              type: 'EXPENSE',
              category: 'Alimentação',
              categoryId: 'food',
              competenceDate: '2026-01-15',
              duplicateWarning: null,
            },
            {
              line: 3,
              description: 'Cinema',
              amount: '-40.00',
              type: 'EXPENSE',
              category: 'Lazer',
              categoryId: null,
              competenceDate: '2026-01-16',
              duplicateWarning: null,
            },
          ],
          unknownCategories: ['Lazer'],
          summary: {
            rowCount: 2,
            validCount: 2,
            errorCount: 0,
            unknownCategoryCount: 1,
            duplicateWarningCount: 0,
          },
        });
      }
      if (url.includes('/api/imports/confirm')) {
        return Response.json({
          id: 'batch-1',
          importBatchId: 'batch-1',
          created: 2,
          skipped: 0,
          deselected: 0,
          errors: [],
        });
      }
      if (url.endsWith('/api/imports')) {
        return Response.json([
          {
            id: 'batch-1',
            importMode: 'transactions',
            parserId: 'standard',
            fileName: 'extrato.csv',
            accountId: 'acc-1',
            accountLabel: 'Nubank CC',
            createdCount: 2,
            skippedCount: 0,
            errorCount: 0,
            createdAt: '2026-01-20T00:00:00.000Z',
          },
        ]);
      }
      return new Response(null, { status: 404 });
    });

    renderImportApp();

    expect(
      await screen.findByRole('heading', { name: 'Importar' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Fatura de cartão' }),
    ).toBeEnabled();

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(
      ['data,descricao,valor,categoria\n'],
      'extrato.csv',
      { type: 'text/csv' },
    );
    await user.upload(fileInput, file);

    await user.click(screen.getByRole('button', { name: 'Pré-visualizar' }));

    expect(await screen.findByText('Cinema')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Categorias desconhecidas' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /Importar linha 2/i }),
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: /Importar linha 3/i }),
    ).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Confirmar importação' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      '2 criados, 0 ignorados',
    );
    expect(
      screen.getByRole('link', { name: 'Ver lançamentos' }),
    ).toHaveAttribute('href', '/lancamentos');
    expect(await screen.findByText('extrato.csv')).toBeInTheDocument();

    const confirmCall = vi
      .mocked(fetch)
      .mock.calls.find((call) => String(call[0]).includes('/confirm'));
    const body = confirmCall?.[1]?.body as FormData;
    expect(JSON.parse(String(body.get('categoryMappings')))).toEqual({
      Lazer: { create: { name: 'Lazer' } },
    });
    expect(JSON.parse(String(body.get('selectedLines')))).toEqual([2, 3]);
  });

  it('defaults existing duplicates off and deselects warning rows', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Response.json({ id: 'u1', username: 'mao' });
      }
      if (url.includes('/api/setup/status')) {
        return Response.json(setupOk);
      }
      if (url.includes('/api/imports/options')) {
        return Response.json(defaultOptions);
      }
      if (url.endsWith('/api/imports') && (!init || init.method === undefined)) {
        return Response.json([]);
      }
      if (url.includes('/api/categories')) {
        return Response.json([
          {
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
          },
        ]);
      }
      if (url.includes('/api/imports/preview')) {
        return Response.json({
          rows: [
            {
              line: 2,
              description: 'NuTag A',
              amount: '-12.00',
              type: 'EXPENSE',
              category: 'Alimentação',
              categoryId: 'food',
              competenceDate: '2026-01-06',
              duplicateWarning: 'existing',
            },
            {
              line: 3,
              description: 'NuTag B',
              amount: '-12.00',
              type: 'EXPENSE',
              category: 'Alimentação',
              categoryId: 'food',
              competenceDate: '2026-01-06',
              duplicateWarning: 'within_file',
            },
            {
              line: 4,
              description: 'NuTag C',
              amount: '-12.00',
              type: 'EXPENSE',
              category: 'Alimentação',
              categoryId: 'food',
              competenceDate: '2026-01-06',
              duplicateWarning: 'within_file',
            },
          ],
          unknownCategories: [],
          summary: {
            rowCount: 3,
            validCount: 3,
            errorCount: 0,
            unknownCategoryCount: 0,
            duplicateWarningCount: 3,
          },
        });
      }
      if (url.includes('/api/imports/confirm')) {
        return Response.json({
          id: 'batch-2',
          importBatchId: 'batch-2',
          created: 0,
          skipped: 0,
          deselected: 3,
          errors: [],
        });
      }
      if (url.endsWith('/api/imports')) {
        return Response.json([]);
      }
      return new Response(null, { status: 404 });
    });

    renderImportApp();

    expect(
      await screen.findByRole('heading', { name: 'Importar' }),
    ).toBeInTheDocument();

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(
      fileInput,
      new File(['csv'], 'dup.csv', { type: 'text/csv' }),
    );
    await user.click(screen.getByRole('button', { name: 'Pré-visualizar' }));

    expect(await screen.findByText(/Já importado/)).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /Importar linha 2/i }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: /Importar linha 3/i }),
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: /Importar linha 4/i }),
    ).toBeChecked();

    await user.click(
      screen.getByRole('button', { name: 'Desmarcar avisos de duplicação' }),
    );

    expect(
      screen.getByRole('checkbox', { name: /Importar linha 3/i }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: /Importar linha 4/i }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('button', { name: 'Confirmar importação' }),
    ).toBeDisabled();
  });

  it('switches to invoice mode with card and invoice selectors', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Response.json({ id: 'u1', username: 'mao' });
      }
      if (url.includes('/api/setup/status')) {
        return Response.json(setupOk);
      }
      if (url.includes('/api/imports/options')) {
        return Response.json(defaultOptions);
      }
      if (url.includes('/api/imports')) {
        return Response.json([]);
      }
      if (url.includes('/api/categories')) {
        return Response.json([]);
      }
      return new Response(null, { status: 404 });
    });

    renderImportApp();

    expect(
      await screen.findByRole('heading', { name: 'Importar' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fatura de cartão' }));

    expect(
      screen.getByText(/remova as linhas de pagamento/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Cartão')).toBeInTheDocument();
    expect(screen.getByLabelText('Fatura')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /08\/2026/i })).toBeInTheDocument();
  });

  it('redirects to setup when there are no accounts or cards', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Response.json({ id: 'u1', username: 'mao' });
      }
      if (url.includes('/api/setup/status')) {
        return Response.json({
          hasAccounts: false,
          hasCards: false,
          hasCategories: true,
          readyForImport: false,
        });
      }
      if (url.includes('/api/imports/options')) {
        return Response.json({
          modes: [],
          parsers: [{ id: 'standard', label: 'Padrão' }],
          accounts: [],
          cards: [],
          invoicesByCard: {},
        });
      }
      if (url.includes('/api/imports')) {
        return Response.json([]);
      }
      if (url.includes('/api/categories')) {
        return Response.json([]);
      }
      return new Response(null, { status: 404 });
    });

    renderImportApp();

    expect(
      await screen.findByRole('heading', { name: 'Vamos começar' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/cadastre ao menos uma conta ou cartão/i),
    ).toBeInTheDocument();
  });
});
