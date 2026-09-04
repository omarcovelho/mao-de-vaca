import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from './toast';

function Probe() {
  const toast = useToast();
  return (
    <div>
      <button type="button" onClick={() => toast.success('Salvo com sucesso')}>
        Sucesso
      </button>
      <button type="button" onClick={() => toast.error('Falha ao salvar')}>
        Erro
      </button>
      <button type="button" onClick={() => toast.info('Informação')}>
        Info
      </button>
    </div>
  );
}

afterEach(() => {
  cleanup();
});

describe('ToastProvider', () => {
  it('shows success and error toasts and allows dismiss', async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Sucesso' }));
    expect(screen.getByRole('status')).toHaveTextContent('Salvo com sucesso');

    await user.click(screen.getByRole('button', { name: 'Erro' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao salvar');

    await user.click(screen.getAllByRole('button', { name: 'Fechar' })[0]);
    expect(screen.queryByText('Salvo com sucesso')).not.toBeInTheDocument();
  });

  it('auto-dismisses after timeout', async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider dismissMs={50}>
        <Probe />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Info' }));
    expect(screen.getByRole('status')).toHaveTextContent('Informação');

    await screen.findByText('Informação');
    await vi.waitFor(
      () => {
        expect(screen.queryByText('Informação')).not.toBeInTheDocument();
      },
      { timeout: 500 },
    );
  });
});
