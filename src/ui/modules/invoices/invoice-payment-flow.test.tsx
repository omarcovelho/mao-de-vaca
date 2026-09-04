import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/toast';
import { InvoiceDetailPanel } from './invoice-detail-panel';

function renderPanel(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('Invoice payment link UI', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('links a debit and shows quitada status', async () => {
    const user = userEvent.setup();
    const onLoaded = vi.fn();

    const openDetail = {
      id: 'inv-1',
      cardId: 'card-1',
      referenceMonth: '2026-08-01',
      dueDate: '2026-09-10',
      balance: -500,
      status: 'open',
      createdAt: '2026-08-01T00:00:00.000Z',
      card: {
        id: 'card-1',
        label: 'Nubank Roxinho',
        bank: { id: 'b1', name: 'Nubank' },
      },
      transactions: [
        {
          id: 'tx-card-1',
          description: 'Mercado',
          amount: -500,
          type: 'EXPENSE',
          competenceDate: '2026-08-15',
          cashDate: null,
          active: true,
          category: {
            id: 'food',
            name: 'Alimentação',
            color: '#2d6a4f',
            icon: 'utensils',
            kind: 'EXPENSE',

          systemKey: null,
          },
        },
      ],
      payments: [],
    };

    const paidDetail = {
      ...openDetail,
      balance: 0,
      status: 'paid',
      payments: [
        {
          id: 'pay-1',
          description: 'Pagamento fatura Nubank',
          amount: -500,
          type: 'INVOICE_PAYMENT',
          competenceDate: '2026-09-10',
          cashDate: '2026-09-10',
          account: {
            id: 'acc-1',
            label: 'Conta Nubank',
            bank: { id: 'b1', name: 'Nubank' },
          },
        },
      ],
      transactions: [
        {
          ...openDetail.transactions[0],
          cashDate: '2026-09-10',
        },
      ],
    };

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/api/invoices/inv-1' && method === 'GET') {
        return Response.json(openDetail);
      }
      if (url === '/api/accounts') {
        return Response.json([
          {
            id: 'acc-1',
            label: 'Conta Nubank',
            active: true,
            bank: { id: 'b1', name: 'Nubank' },
          },
        ]);
      }
      if (url.includes('/api/transactions?') && method === 'GET') {
        return Response.json({
          regime: 'competence',
          from: '2026-08-26',
          to: '2026-09-25',
          items: [
            {
              id: 'pay-1',
              description: 'Pagamento fatura Nubank',
              amount: -500,
              type: 'EXPENSE',
              competenceDate: '2026-09-10',
              cashDate: '2026-09-10',
              displayDate: '2026-09-10',
              active: true,
              category: {
                id: 'transfer',
                name: 'Transferências',
                color: '#555',
                icon: 'arrow',
                kind: 'NON_EXPENSE',

              systemKey: null,
              },
              account: {
                id: 'acc-1',
                label: 'Conta Nubank',
                bank: { id: 'b1', name: 'Nubank' },
              },
              card: null,
              invoiceId: null,
            transferCounterpartId: null,
            },
          ],
        });
      }
      if (url === '/api/invoices/inv-1/payments' && method === 'POST') {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          transactionIds: string[];
        };
        expect(body.transactionIds).toEqual(['pay-1']);
        return Response.json(paidDetail);
      }
      return new Response(null, { status: 404 });
    });

    renderPanel(
      <InvoiceDetailPanel
        invoiceId="inv-1"
        onBack={() => undefined}
        onLoaded={onLoaded}
      />,
    );

    expect(await screen.findByText('Fatura Ago/2026')).toBeInTheDocument();
    expect(screen.getByText(/Aberta/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Vincular pagamento' }));
    expect(
      await screen.findByText('Pagamento fatura Nubank'),
    ).toBeInTheDocument();

    const candidateRow = screen.getByText('Pagamento fatura Nubank').closest('li');
    expect(candidateRow).toBeTruthy();
    await user.click(within(candidateRow!).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Confirmar vínculo' }));
    const dialog = screen.getByRole('dialog', { name: 'Vincular pagamento' });
    await user.click(within(dialog).getByRole('button', { name: 'Vincular' }));

    expect(await screen.findByText(/Quitada/)).toBeInTheDocument();
    expect(screen.getByText('Pagamentos vinculados')).toBeInTheDocument();
    expect(onLoaded).toHaveBeenCalled();
  });

  it('edits invoice due date', async () => {
    const user = userEvent.setup();
    const detail = {
      id: 'inv-2',
      cardId: 'card-1',
      referenceMonth: '2026-08-01',
      dueDate: '2026-09-10',
      balance: -100,
      status: 'open',
      createdAt: '2026-08-01T00:00:00.000Z',
      card: {
        id: 'card-1',
        label: 'Nubank Roxinho',
        bank: { id: 'b1', name: 'Nubank' },
      },
      transactions: [],
      payments: [],
    };

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/invoices/inv-2' && method === 'GET') {
        return Response.json(detail);
      }
      if (url === '/api/invoices/inv-2' && method === 'PATCH') {
        const body = JSON.parse(String(init?.body ?? '{}')) as { dueDate: string };
        expect(body.dueDate).toBe('2026-09-20');
        return Response.json({ ...detail, dueDate: '2026-09-20' });
      }
      return new Response(null, { status: 404 });
    });

    renderPanel(
      <InvoiceDetailPanel invoiceId="inv-2" onBack={() => undefined} />,
    );

    expect(await screen.findByText(/Vence 10\/09\/2026/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Editar' }));

    const input = screen.getByLabelText('Vencimento');
    await user.clear(input);
    await user.type(input, '2026-09-20');
    await user.click(screen.getByRole('button', { name: 'Salvar vencimento' }));

    expect(await screen.findByText(/Vence 20\/09\/2026/)).toBeInTheDocument();
  });
});
