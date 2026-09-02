import { FormEvent, useEffect, useState } from 'react';
import * as accountsApi from './api';
import { BankFields } from './bank-fields';
import type { Origin } from './types';

export function AccountsPage() {
  const [items, setItems] = useState<Origin[]>([]);
  const [label, setLabel] = useState('');
  const [bankId, setBankId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await accountsApi.listAccounts());
    } catch {
      setError('Não foi possível carregar as contas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!bankId) {
      setError('Selecione um banco.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await accountsApi.createAccount({ label, bankId });
      setLabel('');
      await load();
    } catch {
      setError('Não foi possível criar a conta.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(id: string) {
    setError(null);
    try {
      await accountsApi.deactivateAccount(id);
      await load();
    } catch {
      setError('Não foi possível desativar a conta.');
    }
  }

  return (
    <section className="origins">
      <h1>Contas</h1>
      <p>Cadastre contas bancárias com apelido e banco.</p>

      <form onSubmit={handleSubmit} className="origin-form">
        <label>
          Apelido
          <input
            name="label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            required
          />
        </label>
        <BankFields
          bankId={bankId}
          onBankIdChange={setBankId}
          onError={setError}
        />
        <button type="submit" disabled={submitting || !bankId}>
          {submitting ? 'Salvando…' : 'Adicionar conta'}
        </button>
      </form>

      {error ? <p role="alert">{error}</p> : null}

      {loading ? (
        <p>Carregando…</p>
      ) : items.length === 0 ? (
        <p>Nenhuma conta cadastrada ainda.</p>
      ) : (
        <ul className="origin-list">
          {items.map((item) => (
            <li key={item.id}>
              <span>
                <strong>{item.label}</strong> — {item.bank.name}
              </span>
              <button type="button" onClick={() => void handleDeactivate(item.id)}>
                Desativar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
