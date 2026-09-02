# V1 — Auth slice

**Branch:** `feature/v1-auth`  
**Status:** Implemented  
**Roadmap:** [MVP_EPIC_ROADMAP.md](../MVP_EPIC_ROADMAP.md)

## Resultado

Login em `/login` com usuário fixo (env/seed); JWT em cookie httpOnly (`mdv_token`, 7 dias); rotas protegidas na API e na SPA; logout e expiração levam de volta ao login.

## Escopo entregue

| Camada | Entrega |
|--------|---------|
| Prisma | Modelo `User`; migration inicial; seed via `AUTH_USERNAME` / `AUTH_PASSWORD` |
| Server | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`; Passport local + JWT cookie; `JwtAuthGuard` global; `@Public()` em login e health |
| UI | Página `/login` (PT); `AuthProvider`; guard de rotas; botão Sair; 401 limpa sessão |
| Env | `JWT_SECRET`, `AUTH_USERNAME`, `AUTH_PASSWORD` em `.env.example` |

## Expiração

- JWT `expiresIn: '7d'` e cookie `maxAge` alinhados via constante compartilhada.
- Token expirado → API `401`; SPA trata como deslogado e redireciona para `/login`.
- Sem refresh token no MVP.

## Sign-off

- [x] `npx prisma db seed` — usuário seedado
- [x] `curl` login → cookie `mdv_token`; `GET /api/auth/me` autenticado OK
- [x] `GET /api/auth/me` sem cookie → `401`; logout → `401`
- [x] `GET /api/health` público OK
- [x] `npm run test` e `npm run lint` verdes
- [ ] Browser: `/` → redirect `/login` → entrar → home → Sair → `/login` (manual)
