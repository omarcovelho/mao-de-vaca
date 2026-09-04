import { FormEvent, useEffect, useMemo, useState } from 'react';
import { SearchableSelect } from '../../components/searchable-select';
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
  const [showNewBank, setShowNewBank] = useState(false);

  const bankOptions = useMemo(
    () => banks.map((bank) => ({ value: bank.id, label: bank.name })),
    [banks],
  );

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
      setShowNewBank(false);
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
        <SearchableSelect
          aria-label="Banco"
          options={bankOptions}
          value={bankId}
          onChange={onBankIdChange}
          disabled={loadingBanks || banks.length === 0}
          placeholder={
            banks.length === 0 ? 'Nenhum banco cadastrado' : 'Selecione…'
          }
        />
      </label>

      {showNewBank ? (
        <div className="new-bank">
          <label>
            Nome do banco
            <input
              name="newBankName"
              value={newBankName}
              onChange={(event) => setNewBankName(event.target.value)}
              placeholder="Nome do banco"
            />
          </label>
          <div className="new-bank__actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={(event) => void handleCreateBank(event)}
              disabled={creatingBank || !newBankName.trim()}
            >
              {creatingBank ? 'Cadastrando…' : 'Cadastrar banco'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setShowNewBank(false);
                setNewBankName('');
                onError(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn--secondary bank-fields__add-bank"
          onClick={() => setShowNewBank(true)}
        >
          Cadastrar novo banco
        </button>
      )}
    </div>
  );
}
