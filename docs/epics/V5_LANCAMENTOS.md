# V5 — Lançamentos slice

**Branch:** `feature/v5-lancamentos`  
**Status:** Implemented  
**Roadmap:** [MVP_EPIC_ROADMAP.md](../MVP_EPIC_ROADMAP.md)

## Resultado

Lista de lançamentos **por mês + regime** (competência/caixa), com todas as contas no padrão; filtros opcionais (categoria, conta, data de/até); edição inline de categoria e desativação soft na própria tela. Cartão/fatura ficam para V4–V6.

## Escopo entregue

| Camada | Entrega |
|--------|---------|
| Prisma | `Transaction.active` (default true) |
| Server | `GET /api/transactions?regime&from&to&categoryId?&accountId?&includeInactive?`; `PATCH /api/transactions/:id` (`categoryId`, `active`); folha + kind |
| UI | `/lancamentos` month+regime; filtros adicionais; category click-to-edit; Desativar; `RegimeProvider` global; home Recentes; link pós-import |
| Docs | Roadmap (V5 após V3 ok); ARCHITECTURE; UI_REFERENCE |

## Notas

- **Desvio explícito:** V5 após V3 sem V4 — só lançamentos de conta.
- Para conta, `cashDate === competenceDate`; toggle de regime já usa a coluna correta.
- Desativar não remove `dedupKey` — reimport continua a ignorar a linha.
- Sem filtro por conta no padrão (todas as contas); conta é filtro opcional.

## Sign-off

- [x] GET listagem mês/regime + filtros
- [x] PATCH categoria folha + desativar
- [x] UI `/lancamentos` + Vitest
- [x] Regime global + Recentes + CTA import
- [x] Docs atualizados
