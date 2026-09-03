# V2.5 — Categories slice

**Branch:** `feature/v2-5-categories`  
**Status:** Implemented  
**Roadmap:** [MVP_EPIC_ROADMAP.md](../MVP_EPIC_ROADMAP.md)

## Resultado

Árvore de categorias (profundidade máxima 5) com **nome, cor e ícone**; seed da taxonomia MVP por usuário; `GET /api/setup/status.hasCategories` baseado em folhas ativas; tela `/categorias` e banner soft na home quando não há categorias.

## Escopo entregue

| Camada | Entrega |
|--------|---------|
| Prisma | `Category` (`parentId`, `kind`, `color`, `icon`, `active`); migration; `category-seed-data.js` + seed |
| Server | `GET/POST/PATCH /api/categories`; herança de kind/cor/ícone; depth ≤5; desativação em cascata; `hasCategories` real |
| UI | `/categorias` com árvore compacta, “Nova subcategoria” na linha, criar/editar/desativar; nav Categorias; CTA soft na home |
| Docs | PROJECT_DEFINITION §3.6 / RF-00i; ARCHITECTURE; roadmap; UI_REFERENCE; rules |

## Notas

- Lançamentos (V3+) vinculam apenas **folhas**.
- `kind` imutável após create; usuário edita nome, cor e ícone.
- Seed: filhos só onde há nomes distintos; **Assinaturas** e categorias com um único leaf homônimo (Lazer, Educação, Viagem, Presentes, Doações) ficam só na raiz (a raiz é a folha).
- Seed depth-2 quando há filhos; API permite aninhar até depth 5.
- CTA de categorias é recomendação (RF-00k), não bloqueia importação.

## Sign-off

- [x] Migration Category aplicada; seed da taxonomia
- [x] CRUD HTTP + testes (unicidade, depth, cor/ícone, cascata, setup/status)
- [x] UI `/categorias` + banner home + Vitest
- [x] Docs e rules atualizados
- [ ] Browser: login → categorias seedadas → editar → criar filha (manual)
