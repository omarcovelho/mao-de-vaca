import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchableSelect } from './searchable-select';

const OPTIONS = [
  { value: 'a', label: 'Alimentação' },
  { value: 'b', label: 'Moradia › Aluguel' },
  { value: 'c', label: 'Transporte' },
];

afterEach(() => {
  cleanup();
});

describe('SearchableSelect', () => {
  it('opens, filters by typing, and selects an option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SearchableSelect
        aria-label="Categoria"
        options={OPTIONS}
        value=""
        onChange={onChange}
        placeholder="Selecione…"
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Categoria' }));
    const filter = screen.getByRole('textbox', { name: 'Filtrar opções' });
    await user.type(filter, 'alu');

    expect(screen.getByRole('option', { name: 'Moradia › Aluguel' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Alimentação' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: 'Moradia › Aluguel' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('closes on Escape without changing value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SearchableSelect
        aria-label="Categoria"
        options={OPTIONS}
        value="a"
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Categoria' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows empty message when filter matches nothing', async () => {
    const user = userEvent.setup();

    render(
      <SearchableSelect
        aria-label="Categoria"
        options={OPTIONS}
        value=""
        onChange={() => undefined}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Categoria' }));
    await user.type(screen.getByRole('textbox', { name: 'Filtrar opções' }), 'zzzz');

    expect(screen.getByText('Nenhuma opção encontrada')).toBeInTheDocument();
  });

  it('does not open when disabled', async () => {
    const user = userEvent.setup();

    render(
      <SearchableSelect
        aria-label="Categoria"
        options={OPTIONS}
        value=""
        onChange={() => undefined}
        disabled
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Categoria' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('supports an empty option for filters', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SearchableSelect
        aria-label="Filtro"
        options={OPTIONS}
        value=""
        onChange={onChange}
        allowEmpty
        emptyLabel="Todas"
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Filtro' }));
    await user.click(screen.getByRole('option', { name: 'Todas' }));
    expect(onChange).toHaveBeenCalledWith('');
  });
});
