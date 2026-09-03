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
import { ImportPage } from './import-page';

function renderImportApp(initialPath = '/importar') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <SetupStatusProvider>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/contas" element={<AccountsPage />} />
                <Route element={<RequiresOrigins />}>
                  <Route path="/importar" element={<ImportPage />} />
                </Route>
              </Route>
            </Route>
          </Routes>
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
        return Response.json({
          modes: [
            { id: 'transactions', label: 'Extrato de conta', enabled: true },
            { id: 'invoice', label: 'Fatura de cartão', enabled: false },
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
        });
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
            },
            {
              line: 3,
              description: 'Cinema',
              amount: '-40.00',
              type: 'EXPENSE',
              category: 'Lazer',
              categoryId: null,
              competenceDate: '2026-01-16',
            },
          ],
          unknownCategories: ['Lazer'],
          summary: {
            rowCount: 2,
            validCount: 2,
            errorCount: 0,
            unknownCategoryCount: 1,
          },
        });
      }
      if (url.includes('/api/imports/confirm')) {
        return Response.json({
          id: 'batch-1',
          importBatchId: 'batch-1',
          created: 2,
          skipped: 0,
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
    ).toBeDisabled();

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

    await user.click(screen.getByRole('button', { name: 'Confirmar importação' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      '2 criados, 0 ignorados',
    );
    expect(await screen.findByText('extrato.csv')).toBeInTheDocument();

    const confirmCall = vi
      .mocked(fetch)
      .mock.calls.find((call) => String(call[0]).includes('/confirm'));
    const body = confirmCall?.[1]?.body as FormData;
    expect(JSON.parse(String(body.get('categoryMappings')))).toEqual({
      Lazer: { create: { name: 'Lazer' } },
    });
  });

  it('asks to register an account when none exist', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Response.json({ id: 'u1', username: 'mao' });
      }
      if (url.includes('/api/setup/status')) {
        return Response.json({
          hasAccounts: false,
          hasCards: true,
          hasCategories: true,
          readyForImport: false,
        });
      }
      if (url.includes('/api/imports/options')) {
        return Response.json({
          modes: [],
          parsers: [{ id: 'standard', label: 'Padrão' }],
          accounts: [],
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
      await screen.findByText(/cadastre uma conta para importar extratos/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir para contas' })).toHaveAttribute(
      'href',
      '/contas',
    );
  });
});
