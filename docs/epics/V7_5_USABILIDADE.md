# V7.5 — Usabilidade e reversibilidade

**Branch:** `feature/v7-5-usabilidade`  
**Status:** In progress (slice A done)  
**Roadmap:** [MVP_EPIC_ROADMAP.md](../MVP_EPIC_ROADMAP.md)

## Resultado

O usuário **desfaz erros** do ciclo mensal (pagamento de fatura e transferência entre contas) e usa o app com menos atrito: reativa o que desativou, cria fatura na importação, filtra lançamentos por cartão/texto/categoria pai, vê compras de cartão **sem caixa** e faturas em aberto na home, e navega o mês na visão geral.

Não muda regras de contabilização (RN-01, RN-02, RN-06, RN-07). Completa lacunas de RF já escritas (RF-02c, RF-22) e adiciona reversibilidade que o V6 deixou de mão única.

## Fora deste épico

- **Compra-pai (V8)** — adiada; parcelas continuam lançamentos soltos.
- **V9 (piloto)** — Compose, checklist e seed de máquina limpa. Este slice vem **antes** do piloto.
- Parsers por banco, lançamento manual, orçamentos, casamento automático pagamento↔fatura.

## Depende de

V6 (vínculo de pagamento + `cashDate` nas compras) e V7 (home/relatórios). Transferências entre contas (`TransferLink`) já existem em `/lancamentos`.

## Entregas verticais (visão)

| Camada | Escopo |
|--------|--------|
| **Prisma** | `Transaction.categoryId` opcional; `InvoicePaymentLink.previousCategoryId`; FKs de categoria anterior em `TransferLink` (slice F) |
| **`src/server/`** | Desvincular pagamento; zerar `cashDate` sem pagamentos; `GET /api/invoices`; filtros `cardId` / `q` / categoria pai; unlink de transferência sem copiar categoria |
| **`src/ui/`** | Desvincular na fatura; reativar + inativos; nova fatura em `/importar`; filtros; marcador “sem caixa”; home com mês + faturas abertas; rótulo “Sem categoria” quando `category` é null |
| **Docs** | Na implementação: PROJECT_DEFINITION (RFs novos) e ARCHITECTURE (rotas). Este arquivo é a spec |

**Demo:** Importar fatura + extrato → vincular pagamento errado → desvincular → fatura volta a aberta e compras somem do caixa → vincular o débito certo → classificar PIX como transferência → desfazer a classificação sem recategorizar a outra perna → filtrar cartão / buscar descrição → home do mês anterior com faturas em aberto.

**Mapeia para:** RF-02c, RF-12 (simétrico), RF-22; RN-06, RN-07. RFs novos na implementação: desvincular pagamento, reativar, busca por descrição.

---

## Slices (ordem de implementação)

TDD no `server/`; Vitest na UI depois de cada slice. Copy em português. Sem imports `server/` ↔ `ui/`.

### A — Desvincular pagamento de fatura

Hoje o vínculo é de mão única: `POST /api/invoices/:id/payments`; `PATCH` de categoria recusa `INVOICE_PAYMENT`.

| Item | Contrato |
|------|----------|
| API | `DELETE /api/invoices/:id/payments/:transactionId` → detalhe da fatura atualizado |
| Ao vincular | Gravar `previousCategoryId` no `InvoicePaymentLink` (categoria do débito **antes** de virar pagamento; pode ser null) |
| Ao desvincular | Apagar o link; restaurar o débito: `type` pelo sinal (`EXPENSE` se valor negativo); `categoryId` = `previousCategoryId` se a folha ainda existir e estiver ativa, senão **`null` (sem categoria)** |
| Caixa | Chamar recálculo de `cashDate` das compras da fatura. **Se não restar pagamento ativo, `cashDate = null`** nas compras (`cardId` + `invoiceId`) |
| Guards | 404 fatura; 400 se o id não estiver vinculado a essa fatura |
| UI | Em `invoice-detail-panel.tsx`, ação **Desvincular** em cada pagamento (confirmação) |

Não permitir reclassificar `INVOICE_PAYMENT` por `/lancamentos` — o caminho continua sendo a fatura.

Despesas sem categoria entram nos totais e na quebra por categoria como fatia sintética **Sem categoria** (`categoryId: null`).

### B — Reativar desativados

`includeInactive` e `PATCH active` já existem em lançamentos, contas, cartões e categorias. A UI só desativa.

| Superfície | Comportamento |
|------------|----------------|
| `/lancamentos` | Toggle **Mostrar inativos**; botão **Reativar** (`PATCH active: true`). Inativos visivelmente distintos |
| `/contas`, `/cartoes` | Idem (`PATCH /api/accounts/:id` e `/api/cards/:id` já aceitam `active: true`) |
| `/categorias` | Idem. `PATCH active: true` já existe **só no nó**. Reativar o nó clicado; se o pai estiver inativo, reativar ancestrais para a linha voltar à árvore. Filhos inativos **não** reativam em cascata |
| Listagens padrão | Continuam só ativos, salvo o toggle |

Desativar continua sem apagar `dedupKey`. Reativar não reabre importação de origens desativadas até o usuário reativar.

### C — Criar fatura na importação (RF-02c)

Em `/importar` modo fatura, se o cartão não tiver fatura, hoje só há link para `/cartoes`.

| Item | Contrato |
|------|----------|
| API | Reusar `POST /api/cards/:cardId/invoices` (`referenceMonth`, `dueDate`) |
| UI | CTA **Nova fatura** no formulário (mês de referência + vencimento); após criar, selecionar a fatura e atualizar `invoicesByCard` (reload de `GET /api/imports/options` ou append local) |
| Copy | Português; mesmo vocabulário de `/cartoes` |

### D — Filtros de lançamentos (RF-22)

| Item | Contrato |
|------|----------|
| `GET /api/transactions` | Query opcional `cardId` (origem cartão); `q` (substring case-insensitive em `description`) |
| `categoryId` | Se o id for **folha**, comportamento atual. Se for **pai**, incluir lançamentos cuja `categoryId` está na subárvore (o nó e descendentes) |
| Origens | `accountId` e `cardId` são AND; um lançamento tem só uma origem — os dois juntos tendem a lista vazia (aceitável; não unir) |
| UI | Filtro **Cartão** (contas + cartões como origens); campo **Busca** na descrição; select de categoria passa a listar pais e folhas (pais incluem a subárvore) |

### E — Completude de caixa visível

| Item | Contrato |
|------|----------|
| Lista | Em `/lancamentos`, marcador **sem caixa** quando `cardId` está preenchido e `cashDate` é `null`. Link para a fatura (`/cartoes?invoiceId=`) já existe |
| API | `GET /api/invoices` — lista todas as faturas do usuário com saldo/status derivados (ARCHITECTURE já cita; hoje só `GET /api/cards/:cardId/invoices`). Query opcional `status=open\|partial\|paid` |
| Home | Seletor de **mês** (mesmo padrão de `/relatorios` e `/lancamentos`); bloco **Faturas em aberto** (status `open` ou `partial`): cartão, referência, vencimento, saldo; clique abre `/cartoes?invoiceId=` |
| Vazio | Sem faturas em aberto: não mostrar o bloco (ou uma linha discreta, sem inventar saldo) |

### F — Desvincular transferência sem contaminar a outra perna

Hoje `applyCategoryToLinkedPair` apaga o `TransferLink` e **copia a categoria nova nas duas pernas**.

| Item | Contrato |
|------|----------|
| Ao vincular | Gravar `debitPreviousCategoryId` e `creditPreviousCategoryId` no `TransferLink` |
| Ao sair de `ACCOUNT_TRANSFER` (reclassificar uma perna para EXPENSE/INCOME ou `INVESTMENT`) | Apagar o link. **Perna reclassificada:** categoria escolhida pelo usuário + `type` pelo sinal (ou `TRANSFER` se for investimento). **Outra perna:** `type` pelo sinal; categoria = `*PreviousCategoryId` se a folha existir e estiver ativa, senão **`null` (sem categoria)**. **Não** copiar a categoria nova |
| UI | Toast/copy deixa claro que só este lançamento mudou de categoria; a contraparte volta a aparecer como despesa/receita |

---

## Superfície de API (delta)

Rotas novas ou comportamento novo; o restante permanece.

- `DELETE /api/invoices/:id/payments/:transactionId`
- `GET /api/invoices` — `{ items: Invoice[] }` com saldo/status; `?status=`
- `GET /api/transactions` — `cardId?`, `q?`; `categoryId` de não-folha = subárvore
- Prisma: FKs de categoria anterior nos links (não precisa de tabela de histórico)

---

## Sign-off

- [x] A: DELETE pagamento + `cashDate` null sem pagamentos + UI Desvincular + testes HTTP
- [ ] B: Toggle inativos + Reativar nas quatro telas + Vitest
- [ ] C: Nova fatura em `/importar` + Vitest
- [ ] D: `cardId` / `q` / categoria pai + filtros na UI + testes
- [ ] E: marcador “sem caixa”; `GET /api/invoices`; home com mês + faturas abertas
- [ ] F: unlink de transferência restaura a outra perna sem copiar categoria + testes
- [x] PROJECT_DEFINITION + ARCHITECTURE atualizados no mesmo PR de código (slice A)
- [x] Copy PT; suíte Jest + Vitest verde (slice A)

## Notas

- Fallback de categoria ausente = `categoryId` **null** (não folha “A revisar” nem categoria de sistema). Relatórios usam bucket sintético “Sem categoria”.
- Qualidade: [quality-gate.mdc](../../.cursor/rules/quality-gate.mdc). Fronteiras: [architecture.mdc](../../.cursor/rules/architecture.mdc).
