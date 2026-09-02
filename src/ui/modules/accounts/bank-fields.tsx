import { FormEvent, useEffect, useState } from 'react';
import * as accountsApi from './api';
import type { Bank } from './types';

type BankFieldsProps = {
  bankId: string;
  onBankIdChange: (bankId: string) => void;
  onError: (message: string | null) => void;
};

export function BankFields({
  bankId,
  onBankIdChange,
  onError,
}: BankFieldsProps) {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [newBankName, setNewBankName] = useState('');
  const [creatingBank, setCreatingBank] = useState(false);
  const [loadingBanks, setLoadingBanks] = useState(true);

  async function loadBanks(selectId?: string) {
    setLoadingBanks(true);
    try {
      const list = await accountsApi.listBanks();
      setBanks(list);
      const nextId =
        selectId ??
        (list.some((bank) => bank.id === bankId) ? bankId : list[0]?.id) ??
        '';
      if (nextId !== bankId) {
        onBankIdChange(nextId);
      }
    } catch {
      onError('Não foi possível carregar os bancos.');
    } finally {
      setLoadingBanks(false);
    }
  }

  useEffect(() => {
    void loadBanks();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  async function handleCreateBank(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const name = newBankName.trim();
    if (!name) {
      return;
    }
    setCreatingBank(true);
    onError(null);
    try {
      const created = await accountsApi.createBank(name);
      setNewBankName('');
      await loadBanks(created.id);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : 'Não foi possível criar o banco.',
      );
    } finally {
      setCreatingBank(false);
    }
  }

  return (
    <div className="bank-fields">
      <label>
        Banco
        <select
          name="bankId"
          value={bankId}
          onChange={(event) => onBankIdChange(event.target.value)}
          required
          disabled={loadingBanks || banks.length === 0}
        >
          {banks.length === 0 ? (
            <option value="">Nenhum banco cadastrado</option>
          ) : (
            banks.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.name}
              </option>
            ))
          )}
        </select>
      </label>

      <div className="new-bank">
        <label>
          Cadastrar banco
          <input
            name="newBankName"
            value={newBankName}
            onChange={(event) => setNewBankName(event.target.value)}
            placeholder="Nome do banco"
          />
        </label>
        <button
          type="button"
          onClick={(event) => void handleCreateBank(event)}
          disabled={creatingBank || !newBankName.trim()}
        >
          {creatingBank ? 'Cadastrando…' : 'Cadastrar banco'}
        </button>
      </div>
    </div>
  );
}
