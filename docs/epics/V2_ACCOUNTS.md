# V2 — Accounts slice

**Branch:** `feature/v2-accounts`  
**Status:** Implemented  
**Roadmap:** [MVP_EPIC_ROADMAP.md](../MVP_EPIC_ROADMAP.md)

## Resultado

Após login, onboarding **opcional** convida ao cadastro de contas e cartões (pode **Pular** e ir para a home); CRUD de Contas e Cartões em `/contas` e `/cartoes` com seleção de **Banco** (pré-seed: Nubank, Itaú, Inter, Sofisa, Daycoval) ou cadastro de banco novo; `GET /api/setup/status` expõe o estado do setup.

## Escopo entregue

| Camada | Entrega |
|--------|---------|
| Prisma | Modelos `Bank`, `Account`, `Card` (`bankId`, `label`, `active`, `userId`); migrations; seed dos 5 bancos |
| Server | CRUD banks/accounts/cards; desativação via `PATCH`; `GET /api/setup/status` |
| UI | `/contas`, `/cartoes`; select de banco + “Cadastrar banco”; onboarding skippable; nav Contas/Cartões; copy PT |

## Notas

- Onboarding é **soft**: não bloqueia a home; skip persiste na sessão (`sessionStorage`).
- `hasCategories` permanece `false` até V2.5.
- `readyForImport` = `hasAccounts` (forma estável da API); **sem** enforcement de importação neste épico — V3.
- Contas/cartões desativados ficam fora da listagem padrão (`?includeInactive=true` para incluir).
- Nome de banco é único por `userId`; duplicata → `409`.

## Sign-off

- [x] Migration Bank/Account/Card aplicada; seed dos bancos MVP
- [x] `GET/POST /api/banks`; contas/cartões com `bankId`
- [x] `GET /api/setup/status` autenticado reflete contas/cartões
- [x] CRUD + desativação de contas e cartões (testes HTTP)
- [x] UI: onboarding com Pular → home; select/criar banco; criar conta/cartão
- [x] `npm run test` e `npm run lint` verdes
- [ ] Browser: login → onboarding → Pular ou cadastrar (manual)
