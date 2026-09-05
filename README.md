# Mão de Vaca

![CI](https://github.com/omarcovelho/mao-de-vaca/actions/workflows/ci.yml/badge.svg?branch=master)

Controle pessoal de gastos e receitas (MVP).

## Documentation

- [docs/PROJECT_DEFINITION.MD](docs/PROJECT_DEFINITION.MD) — product scope, domain model, locked decisions
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — technical architecture, repo layout, API modules

## CI/CD

Pull requests e pushes para `develop` e `master` disparam GitHub Actions:

| Check | O que valida |
|-------|----------------|
| `server` | Prisma validate/generate, lint, build, testes unitários (Jest; Postgres service) |
| `ui` | lint, build |
| `security-audit` | `npm audit` (high/critical) na raiz |
| `secrets-scan` | Gitleaks — secrets commitados |
| `CodeQL` | Análise estática de segurança no código |
| `dependency-review` | Dependências vulneráveis introduzidas no PR |

**Branch protection (recomendado):** em `develop` e `master`, exija os checks acima antes do merge. No GitHub: Settings → Branches → Add rule.

**Segurança no repositório (one-time):** ative Secret scanning e Push protection em Settings → Code security.

**Pre-commit:** após `npm install` na raiz, Husky roda lint nos arquivos staged (`src/server/**/*.ts`, `src/ui/**/*.{ts,tsx}`).

Node.js **20** (ver [`.nvmrc`](.nvmrc)).

## Pré-requisitos

- Node.js 20+
- Docker Compose

## Subir o ambiente local

1. Suba o PostgreSQL (porta **5433** no host, para não conflitar com outros Postgres locais):

```bash
docker compose up -d
```

2. Copie as variáveis de ambiente:

```bash
cp .env.example .env
```

3. Instale dependências e gere o cliente Prisma:

```bash
npm install
npm run prisma:generate
```

4. Rode API + SPA em desenvolvimento:

```bash
npm run dev
```

- API: `http://localhost:3000/api/health`
- UI (Vite): `http://localhost:5173` (proxy de `/api` → Nest)

## Scripts

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Nest + Vite em paralelo |
| `npm run build` | Build da UI (`dist/ui`) e do server |
| `npm start` | Sobe o server em produção (serve SPA + API) |
| `npm run lint` | ESLint com `--fix` em server e ui |
| `npm test` | Jest (server) |
