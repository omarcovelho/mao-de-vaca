# V3 — Import conta slice

**Branch:** `feature/v3-import-conta`  
**Status:** Implemented  
**Roadmap:** [MVP_EPIC_ROADMAP.md](../MVP_EPIC_ROADMAP.md)

## Resultado

Importação de CSV no modo **extrato de conta**: pré-visualização no server, mapeamento de categorias desconhecidas, confirmação com persistência de lançamentos (`accountId` + `categoryId`, `cashDate` = `competenceDate`) e histórico de lotes.

## Escopo entregue

| Camada | Entrega |
|--------|---------|
| Prisma | `Transaction`, `ImportBatch`, enums `TransactionType` e `ImportMode` |
| Server | Parser padrão (valor − → EXPENSE, + → INCOME); `GET /api/imports/options`; `POST preview` (não persiste); `POST confirm` (reparse + dedup); `GET /api/imports` |
| UI | `/importar` com pills, origem, parser, dropzone, preview, mapeamento, resumo e histórico |
| Docs | Fixture CSV; ARCHITECTURE; PROJECT_DEFINITION §3.7; backlog de vínculo manual de transferências |

## Notas

- Validação completa no backend; UI só checa arquivo `.csv`, conta e parser.
- Confirm reenvia o arquivo (stateless).
- `dedupKey` inclui `accountId`: o mesmo movimento em outra conta é outro lançamento.
- Todo lançamento persistido leva `importBatchId` do lote (confirm devolve esse `id`); `DELETE /api/imports/:id` faz hard delete do lote (txs + batch), sem apagar fatura; bloqueia se houver `TRANSFER` no lote ou fatura `paid`.
- Transferência Itaú (despesa) / Nubank (receita) = dois imports independentes até vínculo manual futuro.
- Modo fatura entregue em V4.

## Sign-off

- [x] Parser padrão + fixture
- [x] Preview sem persistir; confirm com mapeamento e dedup
- [x] UI `/importar` + Vitest
- [x] Docs atualizados
- [x] Browser: login → importar fixture → confirmar → reimportar (skipped)
