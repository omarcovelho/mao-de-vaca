# V7 — Relatórios slice

**Branch:** `feature/v7-relatorios`  
**Status:** Implemented  
**Roadmap:** [MVP_EPIC_ROADMAP.md](../MVP_EPIC_ROADMAP.md)

## Resultado

Dashboard Conta-only: indicadores do período (gasto, receita, saldo), quebra por categoria com %, evolução mensal (6 meses). Tudo respeita o toggle global de regime. Transferências ficam fora das somas (RN-01).

## Escopo entregue

| Camada | Entrega |
|--------|---------|
| Server | `GET /api/reports/summary`, `by-category` (árvore pai→filho com totais agregados), `monthly-evolution`; exclui `TRANSFER` e inativos |
| UI | `/relatorios` com seletor de mês, stats, gráfico CSS, categorias expansíveis (folha → `/lancamentos?month&categoryId`); `/` com hero + top 3 raízes |
| Docs | Roadmap (V7 após V5 ok); ARCHITECTURE query de evolução |

## Notas

- **Desvio explícito:** V7 após V5 sem V4/V6 — só lançamentos de conta.
- Para Conta, `cashDate === competenceDate`; toggle já filtra a coluna correta.
- Compra-pai (V8) ainda não existe; quando existir, reports devem excluir o agregado das somas (só parcelas contam).
- Quebra por categoria: só raízes na UI; expandir revela filhos com totais roll-up do período.

## Sign-off

- [x] summary / by-category / monthly-evolution + testes HTTP
- [x] UI `/relatorios` + Vitest
- [x] Home com indicadores reais
- [x] Exclusão de transferências
- [x] Docs atualizados
