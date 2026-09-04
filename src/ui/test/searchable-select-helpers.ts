import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/** Open a SearchableSelect by aria-label and pick an option by visible label. */
export async function chooseSearchableOption(
  user: UserEvent,
  comboboxName: string | RegExp,
  optionName: string | RegExp,
) {
  await user.click(screen.getByRole('combobox', { name: comboboxName }));
  const listbox = screen.getByRole('listbox');
  await user.click(within(listbox).getByRole('option', { name: optionName }));
}
