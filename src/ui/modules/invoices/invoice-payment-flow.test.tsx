import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvoiceDetailPanel } from './invoice-detail-panel';

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
              },
              account: {
                id: 'acc-1',
                label: 'Conta Nubank',
                bank: { id: 'b1', name: 'Nubank' },
              },
              card: null,
              invoiceId: null,
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

    render(
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

    expect(await screen.findByText(/Quitada/)).toBeInTheDocument();
    expect(screen.getByText('Pagamentos vinculados')).toBeInTheDocument();
    expect(onLoaded).toHaveBeenCalled();
  });
});
