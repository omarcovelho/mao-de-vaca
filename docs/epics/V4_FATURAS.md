# V4 — Faturas + import cartão

**Branch:** `feature/v4-faturas-import`  
**Status:** Implemented  
**Roadmap:** [MVP_EPIC_ROADMAP.md](../MVP_EPIC_ROADMAP.md)

## Resultado

Criar **Fatura** por cartão (mês de referência + vencimento); importar CSV no modo **fatura** (cartão + fatura + parser); compras/estornos entram na fatura; saldo = soma dos valores importados; status derivado (aberta / quitada).

## Escopo entregue

| Camada | Entrega |
|--------|---------|
| Prisma | `Invoice`; `Transaction.cardId` / `invoiceId`; `cashDate` nullable; `ImportBatch.cardId` / `invoiceId` |
| Server | `GET/POST /api/cards/:cardId/invoices`; import mode `invoice`; parser invoice (`−` gasto, `+` estorno como `EXPENSE`); aliases `date`/`title`/`amount` |
| UI | Faturas em `/cartoes` (lista + criar + hero); `/importar` modo fatura (cartão + fatura) |
| Docs | Fixture CSV; ARCHITECTURE; este épico |

## Notas

- Usuário **remove linhas de pagamento** do CSV antes de importar; o parser não detecta/ignora pagamentos.
- Sinais iguais ao extrato de conta: negativo = gasto; positivo = estorno. Em fatura, positivo **nunca** vira `INCOME` (RN-04).
- `balance = sum(amount)` das txs ativas da fatura; `cashDate` null até vínculo de pagamento (V6).
- Regime caixa exclui lançamentos com `cashDate` null.

## Sign-off

- [x] Invoice CRUD por cartão + saldo derivado
- [x] Import preview/confirm modo fatura + dedup por cardId
- [x] UI `/cartoes` + `/importar` modo fatura
- [x] Docs + fixture
