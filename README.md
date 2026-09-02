# Mão de Vaca

Controle pessoal de gastos e receitas (MVP).

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
