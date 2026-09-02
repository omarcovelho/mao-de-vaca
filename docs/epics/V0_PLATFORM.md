# V0 — Platform slice

**Branch:** `feature/v0-platform`  
**Status:** Implemented  
**Roadmap:** [MVP_EPIC_ROADMAP.md](../MVP_EPIC_ROADMAP.md)

## Resultado

`docker compose up` + `npm run dev` → `GET /api/health` OK; SPA com shell base em português.

## Escopo entregue

| Camada | Entrega |
|--------|---------|
| Compose | PostgreSQL 16 na porta host **5433** |
| Server | NestJS, prefixo `/api`, `GET /api/health`, serve `dist/ui` em prod |
| UI | Vite + React, layout base, página placeholder PT, proxy `/api` |
| Prisma | Cliente conectado (sem modelos de domínio) |

## Notas

- **TDD pulado neste épico** por decisão explícita; aceitação via sign-off manual. Retomar TDD a partir de V1.
- Sem auth nem domínio.

## Sign-off

- [x] `docker compose up -d` — Postgres healthy em `localhost:5433`
- [x] `curl http://localhost:3000/api/health` → `{ "status": "ok" }`
- [x] Browser em `/` (Vite) mostra shell “Mão de Vaca”
