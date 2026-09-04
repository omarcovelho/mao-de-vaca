import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../../components/app-shell';
import { ToastProvider } from '../../components/toast';
import { AuthProvider } from '../auth/auth-context';
import { ProtectedRoute } from '../auth/protected-route';
import { HomePage } from '../accounts/home-page';
import { SetupStatusProvider } from '../accounts/setup-status-context';
import { RegimeProvider } from '../transactions/regime-context';
import { chooseSearchableOption } from '../../test/searchable-select-helpers';
import { CategoriesPage } from './categories-page';

function renderCategoriesApp(initialPath = '/categorias') {
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
                    <Route path="/categorias" element={<CategoriesPage />} />
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

describe('Categories UI flow', () => {
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

  it('lists category tree with color and icon affordances', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Response.json({ id: 'u1', username: 'mao' });
      }
      if (url.includes('/api/setup/status')) {
        return Response.json({
          hasAccounts: true,
          hasCards: false,
          hasCategories: true,
          readyForImport: true,
        });
      }
      if (url.includes('/api/categories')) {
        return Response.json([
          {
            id: 'c1',
            parentId: null,
            name: 'Alimentação',
            kind: 'EXPENSE',
            color: '#DD6B20',
            icon: 'utensils',
            active: true,
            depth: 1,
            isLeaf: false,
            children: [
              {
                id: 'c2',
                parentId: 'c1',
                name: 'Supermercado',
                kind: 'EXPENSE',
                color: '#DD6B20',
                icon: 'utensils',
                active: true,
                depth: 2,
                isLeaf: true,
                children: [],
              },
            ],
          },
        ]);
      }
      return new Response(null, { status: 404 });
    });

    renderCategoriesApp();

    expect(
      await screen.findByRole('heading', { name: 'Categorias' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Alimentação')).toBeInTheDocument();
    expect(screen.queryByText('Supermercado')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Expandir' }));
    expect(await screen.findByText('Supermercado')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Categorias' }),
    ).toBeInTheDocument();
  });

  it('creates a subcategory under a parent', async () => {
    const user = userEvent.setup();
    let tree = [
      {
        id: 'c1',
        parentId: null,
        name: 'Alimentação',
        kind: 'EXPENSE',
        color: '#DD6B20',
        icon: 'utensils',
        active: true,
        depth: 1,
        isLeaf: true,
        children: [] as unknown[],
      },
    ];

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Response.json({ id: 'u1', username: 'mao' });
      }
      if (url.includes('/api/setup/status')) {
        return Response.json({
          hasAccounts: true,
          hasCards: false,
          hasCategories: true,
          readyForImport: true,
        });
      }
      if (url.includes('/api/categories') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as {
          name: string;
          parentId: string;
        };
        const child = {
          id: 'c2',
          parentId: body.parentId,
          name: body.name,
          kind: 'EXPENSE',
          color: '#DD6B20',
          icon: 'utensils',
          active: true,
          depth: 2,
          isLeaf: true,
          children: [],
        };
        tree = [
          {
            ...tree[0],
            isLeaf: false,
            children: [child],
          },
        ];
        return Response.json(child, { status: 201 });
      }
      if (url.includes('/api/categories')) {
        return Response.json(tree);
      }
      return new Response(null, { status: 404 });
    });

    renderCategoriesApp();
    await screen.findByText('Alimentação');

    await user.click(
      screen.getByRole('button', { name: 'Nova subcategoria em Alimentação' }),
    );
    expect(screen.getByText('Em Alimentação')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Categoria pai'),
    ).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Nome'), 'Restaurantes');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Restaurantes')).toBeInTheDocument();
  });

  it('edits name, color and icon', async () => {
    const user = userEvent.setup();
    let category = {
      id: 'c1',
      parentId: null as string | null,
      name: 'Lazer',
      kind: 'EXPENSE',
      color: '#9F7AEA',
      icon: 'ticket',
      active: true,
      depth: 1,
      isLeaf: true,
      children: [] as unknown[],
    };

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Response.json({ id: 'u1', username: 'mao' });
      }
      if (url.includes('/api/setup/status')) {
        return Response.json({
          hasAccounts: true,
          hasCards: false,
          hasCategories: true,
          readyForImport: true,
        });
      }
      if (url.includes('/api/categories/c1') && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as {
          name?: string;
          color?: string;
          icon?: string;
        };
        category = {
          ...category,
          name: body.name ?? category.name,
          color: body.color ?? category.color,
          icon: body.icon ?? category.icon,
        };
        return Response.json(category);
      }
      if (url.includes('/api/categories')) {
        return Response.json([category]);
      }
      return new Response(null, { status: 404 });
    });

    renderCategoriesApp();
    await screen.findByText('Lazer');
    await user.click(screen.getByRole('button', { name: 'Editar' }));

    const nameInput = screen.getByLabelText('Nome');
    await user.clear(nameInput);
    await user.type(nameInput, 'Lazer/Entretenimento');
    await chooseSearchableOption(user, 'Ícone', 'Assinaturas');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('Lazer/Entretenimento'),
    ).toBeInTheDocument();
  });

  it('shows categories banner on home when hasCategories is false', async () => {
    sessionStorage.setItem('mdv_onboarding_finalized', '1');

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
          readyForImport: true,
        });
      }
      return new Response(null, { status: 404 });
    });

    renderCategoriesApp('/');

    expect(
      await screen.findByRole('heading', { name: /setembro de 2026/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Cadastre suas categorias'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ir para categorias' }),
    ).toHaveAttribute('href', '/categorias');
  });

  it('deactivates a category from the list', async () => {
    const user = userEvent.setup();
    let items = [
      {
        id: 'c1',
        parentId: null as string | null,
        name: 'Doações',
        kind: 'EXPENSE',
        color: '#48BB78',
        icon: 'hand-heart',
        active: true,
        depth: 1,
        isLeaf: true,
        children: [] as unknown[],
      },
    ];

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Response.json({ id: 'u1', username: 'mao' });
      }
      if (url.includes('/api/setup/status')) {
        return Response.json({
          hasAccounts: true,
          hasCards: false,
          hasCategories: true,
          readyForImport: true,
        });
      }
      if (url.includes('/api/categories/c1') && init?.method === 'PATCH') {
        items = [];
        return Response.json({
          id: 'c1',
          parentId: null,
          name: 'Doações',
          kind: 'EXPENSE',
          color: '#48BB78',
          icon: 'hand-heart',
          active: false,
          depth: 1,
          isLeaf: true,
        });
      }
      if (url.includes('/api/categories')) {
        return Response.json(items);
      }
      return new Response(null, { status: 404 });
    });

    renderCategoriesApp();
    await screen.findByText('Doações');
    await user.click(screen.getByRole('button', { name: 'Desativar' }));
    const dialog = screen.getByRole('dialog', { name: 'Desativar categoria' });
    await user.click(within(dialog).getByRole('button', { name: 'Desativar' }));

    expect(
      await screen.findByText(/Nenhuma categoria ativa/i),
    ).toBeInTheDocument();
  });
});
