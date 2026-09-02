# Mão de Vaca — Arquitetura do MVP

**Status:** Rascunho para planejamento de implementação  
**Última atualização:** 2026-09-02  
**Fonte de verdade do produto:** [PROJECT_DEFINITION.MD](./PROJECT_DEFINITION.MD)

Este documento descreve *como* o MVP é construído em alto nível. Histórias de usuário, épicos e tarefas devem rastrear até aqui e até a definição de produto (especialmente §3, §5 e §6).

---

## 1. Propósito

Mão de Vaca é uma aplicação web pessoal de controle de gastos e receitas. O usuário **primeiro cadastra contas, cartões e categorias**; em seguida importa extratos e faturas em CSV (pré-categorizados externamente), vinculados a essas origens. O diferencial central é permitir enxergar os gastos sob **dois regimes simultâneos** — competência e caixa — com fatura de cartão modelada como **passivo**, pagamentos de fatura como **transferências** (sem contagem duplicada) e entrada de dados exclusivamente pela **interface web**.

---

## 2. Princípios de arquitetura

| Princípio | Escolha |
|-----------|---------|
| **Dono do domínio** | Módulos em `src/server/` (NestJS) são a única fonte de verdade para regras de negócio, regimes, saldos de fatura e deduplicação |
| **Papel da UI** | React em `src/ui/` renderiza snapshots da API e envia comandos — sem lógica de contabilização duplicada |
| **Formato do app** | Um único app web: NestJS hospeda a API (`/api/**`) e serve o build estático da SPA para o restante |
| **Sem código compartilhado** | `server/` e `ui/` **não importam** tipos, DTOs ou utilitários um do outro; contratos vivem apenas na API HTTP |
| **Cadastro primeiro** | Contas, cartões e categorias são **requisitos do domínio antes da importação**; lançamentos e faturas dependem de origens e categorias cadastradas |
| **Setup obrigatório** | Após login, usuário sem contas/cartões é orientado ao cadastro antes de qualquer outra operação de dados; categorias são recomendadas no onboarding mas não bloqueiam importação |
| **Modularidade futura** | `src/server/` e `src/ui/` são extraíveis como apps independentes; módulos espelhados por domínio (`auth`, `accounts`, `import`, …) dentro de cada camada |
| **Multitenant** | Coluna `userId` em todas as entidades desde o MVP; um único usuário fixo provisionado via env/seed |
| **Importação** | **Única via interface web**, após cadastro de origens; modos transações (Conta) e fatura (Cartão + Fatura); parser selecionável (padrão no MVP) |
| **Segredos** | Credenciais de DB e auth apenas no server — nunca no bundle React |
| **Deploy local** | Docker Compose: PostgreSQL + app Node |

---

## 3. Contexto do sistema

```mermaid
flowchart TB
  subgraph browser [Navegador]
    AccountsUI[Cadastro Contas/Cartões]
    CategoriesUI[Cadastro Categorias]
    ImportUI[Tela de Importação]
    UI[React SPA]
  end
  subgraph app [App Web único Node]
    Router{Roteador HTTP}
    API["NestJS /api/**"]
    Static[SPA estática]
    Domain[Domínio / Contabilização]
    ImportMod[Importação + Parsers]
  end
  DB[(PostgreSQL)]
  CSV[Arquivos CSV externos]

  AccountsUI -->|"/api/* → JSON"| Router
  CategoriesUI -->|"/api/* → JSON"| Router
  ImportUI -->|upload multipart| Router
  UI -->|"/api/* → JSON"| Router
  UI -->|"/* → HTML/JS"| Router
  Router -->|prefixo /api| API
  Router -->|demais rotas| Static
  API --> Domain
  API --> ImportMod
  Domain --> DB
  ImportMod --> Domain
  CSV --> ImportMod
```

**Regra de roteamento:** qualquer requisição com prefixo `/api/**` é tratada pelos controllers NestJS; todas as demais retornam a SPA (fallback `index.html` para client-side routing).

**Internet:** não obrigatória em runtime, exceto para dependências de build. O app opera localmente ou em servidor próprio com PostgreSQL.

---

## 4. Layout do repositório e fronteiras modulares

**Regra:** duas camadas de topo — `src/server/` e `src/ui/` — com módulos de domínio espelhados em cada uma. Comunicação entre camadas **somente via HTTP** (`/api/**`). Nenhuma pasta `shared/`.

```
mao-de-vaca/
  src/
    server/                       # Camada backend — extraível como app NestJS no futuro
      main.ts                     # Bootstrap NestJS + /api/** + serve SPA em prod
      modules/
        auth/                     # Controller, service, guard, DTOs
        accounts/                 # CRUD Conta + Cartão (primeiro módulo de domínio)
        categories/               # CRUD Categoria (antes da importação)
        import/                   # Upload multipart, parsers, modelo canônico, mapeamento de categorias
        transactions/
        invoices/
        parent-purchases/
        reports/
    ui/                           # Camada frontend — extraível como app React no futuro
      main.tsx                    # Entry point React
      app.tsx                     # Shell: layout, providers
      router.tsx                  # Rotas da SPA
      modules/
        auth/
        accounts/                 # Cadastro contas/cartões, onboarding
        categories/               # Cadastro categorias, sugestão no onboarding
        import/
        transactions/
        invoices/
        parent-purchases/
        reports/
  prisma/                         # Schema + migrations (server-only)
  docker-compose.yml
  docs/
    PROJECT_DEFINITION.MD
    ARCHITECTURE.md
```

### Espelhamento de módulos

Cada domínio (`auth`, `accounts`, `categories`, `import`, `transactions`, `invoices`, `parent-purchases`, `reports`) existe em **ambas** as camadas com o mesmo nome. O nome alinha responsabilidades entre server e UI; não há imports cruzados.

| Módulo | `server/modules/` | `ui/modules/` |
|--------|-------------------|---------------|
| **auth** | Login, guard JWT, contexto de tenant | Página de login, proteção de rotas |
| **accounts** | CRUD Conta + Cartão + Banco, `setup/status` | Cadastro, listagem, onboarding pós-login; seleção/criação de banco |
| **categories** | CRUD Categoria; unicidade de nome por `userId` | Listagem, formulário, desativação |
| **import** | Preview/confirm, parsers, deduplicação, mapeamento de categorias, `ImportBatch` | Formulário por modo, pré-visualização com mapeamento, histórico, resumo |
| **transactions** | CRUD, tipos, regimes, filtros | Tabela filtrável de lançamentos |
| **invoices** | Faturas, saldo/status derivados, vínculo pagamento | Lista/detalhe de faturas, UI de vínculo manual |
| **parent-purchases** | Agregado informacional, vínculo parcela↔pai | UI de agrupamento de parcelas |
| **reports** | Cálculos por regime, categorias, evolução mensal | Dashboard, gráficos, toggle de regime |

### Regras de fronteira

| Permitido | Proibido |
|-----------|----------|
| `server/modules/X/` importa de `server/modules/Y/` via interfaces de serviço | Qualquer import de `ui/` a partir de `server/` |
| `ui/modules/X/` importa de `ui/` (shell, componentes comuns) ou de `ui/modules/Y/` | Qualquer import de `server/` a partir de `ui/` |
| UI consome API via `fetch('/api/...')` com tipos definidos localmente em `ui/modules/*/` | Pasta `shared/`, pacotes internos ou tipos importados cross-layer |
| Extração futura: `src/server/` → app NestJS; `src/ui/` → app React/Vite | Lógica de domínio (regimes, saldos, dedup) na camada UI |

```mermaid
flowchart LR
  subgraph uiLayer [src/ui]
    UIMod0[modules/accounts]
    UIModCat[modules/categories]
    UIMod1[modules/auth]
    UIMod2[modules/import]
    UIShell[app + router]
  end
  subgraph serverLayer [src/server]
    SrvMod0[modules/accounts]
    SrvModCat[modules/categories]
    SrvMod1[modules/auth]
    SrvMod2[modules/import]
    SrvMain[main.ts]
  end
  UIMod2 -->|"HTTP /api/**"| SrvMod2
  UIShell --> UIMod0
  UIShell --> UIModCat
  UIShell --> UIMod1
  UIShell --> UIMod2
  SrvMain --> SrvMod0
  SrvMain --> SrvModCat
  SrvMain --> SrvMod1
  SrvMain --> SrvMod2
```

### Dev vs prod

| Ambiente | Comportamento |
|----------|---------------|
| **Dev** | Vite dev server (`ui/`) com proxy `/api` → NestJS (`server/`), ou NestJS com plugin Vite integrado |
| **Prod** | Build de `ui/` em `dist/ui/`; `server/main.ts` serve estáticos e responde `/api/**` |

**Stack:** TypeScript em todo o app (um `package.json`). NestJS, React + Vite, PostgreSQL (Prisma).

**Fora do escopo do MVP:** apps separados em deploy, fila de importação assíncrona, detecção automática de conta/cartão ou parser na importação.

---

## 5. Dados e domínio

### Modelo de entidades

| Entidade | Armazenamento | Notas |
|----------|---------------|-------|
| **User** | PostgreSQL | Tenant/dono dos dados; único usuário seedado no MVP (`AUTH_*` env vars) |
| **Bank** (`Banco`) | PostgreSQL | `id`, `userId`, `name` (único por usuário); seed MVP: Nubank, Itaú, Inter, Sofisa, Daycoval |
| **Account** (`Conta`) | PostgreSQL | `id`, `userId`, `bankId`, `label`, `active` |
| **Card** (`Cartão`) | PostgreSQL | `id`, `userId`, `bankId`, `label`, `active` |
| **Category** (`Categoria`) | PostgreSQL | `id`, `userId`, `name` (único por usuário), `active` |
| **Transaction** | PostgreSQL | Lançamento: `competenceDate`, `cashDate?`, `type`, `amount`, `categoryId`, `accountId` **ou** `cardId`, `dedupKey` |
| **Invoice** | PostgreSQL | Fatura: FK `cardId`, `referenceMonth`, `dueDate`; saldo e status **derivados** |
| **InvoicePaymentLink** | PostgreSQL | Vínculo M:N pagamento↔fatura; suporta pagamento parcial e cross-bank |
| **ParentPurchase** | PostgreSQL | Agregado informacional; não entra em somas; parcelas vinculadas manualmente |
| **ImportBatch** | PostgreSQL | `importMode` (`transactions` \| `invoice`), `accountId` ou `cardId`, `invoiceId?`, `parserId`, resultado |

### Regras derivadas (do domínio)

| Regra | Descrição |
|-------|-----------|
| **Saldo de fatura** | `saldo = (compras − estornos) − pagamentos_vinculados` (PROJECT_DEFINITION §3.5) |
| **Status de fatura** | Derivado do saldo: em aberto / parcialmente paga / quitada |
| **Totais de gasto/receita** | `saldo = receitas − despesas`; transferências não entram (RN-01) |
| **Pagamento de fatura** | Sempre transferência; nunca despesa — evita contagem duplicada (RN-02) |
| **Compra-pai** | Nunca contabilizada; apenas parcelas entram nas somas (RN-03) |
| **Estorno** | Despesa negativa na fatura/período em que apareceu; nunca receita (RN-04) |
| **Investimento** | Transferência: afeta caixa, não afeta gasto nem receita (RN-05) |
| **Caixa de cartão** | Reconhecido pela data do pagamento real da fatura, não pelo vencimento (RN-06) |
| **Completude do caixa** | Gastos de cartão só aparecem em caixa quando pagamentos estão registrados e vinculados (RN-07) |
| **Pré-requisito de importação** | Conta ou cartão cadastrado obrigatório; rejeição sem origem válida (RN-08) |
| **Origens desativadas** | Não aparecem em nova importação; histórico preservado (RN-09) |
| **Fatura e cartão** | Fatura sempre vinculada a cartão cadastrado (RN-10) |
| **Categoria e lançamento** | Todo lançamento referencia `categoryId` de categoria cadastrada (RN-11–13) |

### Regimes: competência vs caixa

```mermaid
flowchart TD
  subgraph debit [Lançamento débito/conta]
    D1[competenceDate]
    D2[cashDate = competenceDate]
  end
  subgraph card [Compra de cartão]
    C1[competenceDate = data da compra]
    C2[cashDate = data do pagamento vinculado]
    C3[sem pagamento → só competência]
  end
  subgraph reports [Consultas /reports]
    R1[regime=competence → filtra por competenceDate]
    R2[regime=cash → filtra por cashDate]
  end
  D1 --> R1
  D2 --> R2
  C1 --> R1
  C2 --> R2
  C3 --> R1
```

O toggle de regime (RF-08) é global na UI (`ui/`) e propagado como parâmetro `regime=competence|cash` em todas as chamadas de relatório e listagem.

### Modelo canônico de importação (server-only)

Todo parser, independentemente de banco ou formato, produz lançamentos neste modelo interno antes da persistência:

| Campo | Descrição |
|-------|-----------|
| `competenceDate` | Data de competência |
| `cashDate` | Data de caixa, quando aplicável (débito: igual à competência) |
| `description` | Descrição do lançamento |
| `amount` | Valor (negativo = despesa/estorno; positivo = receita) |
| `type` | `expense` \| `income` \| `transfer` |
| `category` | Nome da categoria pré-atribuída no CSV (string do parser; resolvida para `categoryId` na confirmação) |
| `accountId` | Conta cadastrada (modo transações) — mutuamente exclusivo com `cardId` |
| `cardId` | Cartão cadastrado (modo fatura) |
| `dedupKey` | Identificador estável para deduplicação |
| `invoiceRef` | Referência de fatura, quando aplicável (cartão) |

Interface TypeScript em `src/server/modules/import/parsers/`; mapeamento para entidades Prisma no módulo de domínio. **Não exposto à UI.**

---

## 6. Fluxos principais

### 6.0 Onboarding — cadastro de contas, cartões e categorias

O cadastro é o **primeiro fluxo de dados** após autenticação — anterior a importação, lançamentos e relatórios (RF-00d a RF-00k).

1. Usuário faz login
2. UI consulta `GET /api/setup/status`
3. Se não há contas nem cartões → redirect para `/contas` (ou wizard de setup) com mensagem explicativa
4. Usuário cadastra ao menos uma **Conta** e/ou **Cartão**
5. Sistema **sugere** cadastro de **Categorias** em `/categorias` quando `hasCategories` é false (não bloqueia importação)
6. Somente com conta ou cartão cadastrado a navegação libera importação e demais módulos de dados

```mermaid
flowchart TD
  Login[POST /api/auth/login] --> Check{tem conta ou cartão?}
  Check -->|não| SetupUI[ui/modules/accounts]
  Check -->|sim| CatHint{hasCategories?}
  CatHint -->|não| CatSuggest[ui/modules/categories sugerido]
  CatHint -->|sim| Home[Dashboard / menu completo]
  CatSuggest --> Home
  SetupUI --> Create[POST /api/accounts ou /api/cards]
  Create --> CatHint
  Home --> ImportGate{importar?}
  ImportGate -->|sem origem para modo| SetupUI
  ImportGate -->|ok| ImportUI[ui/modules/import]
```

- Rotas `/contas`, `/cartoes` e `/categorias` (ou aba única "Contas e cartões" + menu Categorias)
- Desativação em vez de delete quando há lançamentos vinculados (contas, cartões e categorias)

### 6.1 Interface web de importação

A importação é o canal de entrada de lançamentos — feita em `ui/modules/import/`, **após** cadastro de origens e **com módulo de categorias disponível** (RF-01, RF-02a–e). Bloqueada se não houver conta (modo transações) ou cartão + fatura (modo fatura).

**Componentes da UI:**

| Componente | Função |
|------------|--------|
| **Seleção de modo** | Transações (extrato) ou fatura (cartão) |
| **Seleção de origem** | Conta cadastrada **ou** Cartão + Fatura de destino |
| **Seleção de parser** | Dropdown; único item "Padrão" no MVP |
| **Upload** | Arquivo `.csv` + botão enviar |
| **Pré-visualização** | Lista de lançamentos parseados; destaque de **categorias desconhecidas** com UI de mapeamento (existente ou criar nova) |
| **Confirmação** | Persistência após 100% das categorias resolvidas (RN-12) |
| **Estado de progresso** | Loading durante processamento síncrono no server |
| **Resumo pós-importação** | Contadores: novos, duplicados ignorados, erros por linha |
| **Histórico** | Lista de `ImportBatch` anteriores |

**Fluxo do usuário:**

1. Usuário autenticado acessa `/importar` (somente se setup de origens completo)
2. Escolhe modo: **transações** ou **fatura**
3. Seleciona **Conta** (transações) ou **Cartão + Fatura** (fatura)
4. Seleciona parser (padrão no MVP)
5. Faz upload do CSV
6. UI envia `multipart/form-data` para `POST /api/imports/preview`
7. Server parseia e retorna preview com `unknownCategories[]`
8. Usuário mapeia categorias desconhecidas (dropdown de cadastradas ou "criar nova")
9. UI envia `POST /api/imports/confirm` com `categoryMappings` + metadados do lote
10. Server persiste com deduplicação, resolvendo `category` → `categoryId`
11. UI exibe resumo e atualiza histórico

```mermaid
sequenceDiagram
  participant User as Usuário
  participant ImportUI as Tela Importação
  participant Preview as POST /api/imports/preview
  participant Confirm as POST /api/imports/confirm
  participant Parser
  participant Categories
  participant Domain

  User->>ImportUI: modo, origem, parser e arquivo CSV
  ImportUI->>Preview: multipart accountId/cardId + parserId + file
  Preview->>Parser: parse(buffer) → CanonicalTransaction[]
  Parser-->>Preview: modelo canônico com category string
  Preview-->>ImportUI: rows, unknownCategories, summary
  User->>ImportUI: mapeia categorias desconhecidas
  ImportUI->>Confirm: categoryMappings + batch metadata
  Confirm->>Categories: resolve/create categoryId
  Confirm->>Domain: persist + deduplicate
  Domain-->>Confirm: ImportResult
  Confirm-->>ImportUI: created, skipped, errors
  ImportUI-->>User: resumo visual
```

**Notas de implementação:**

- Upload via `multipart/form-data` (NestJS `FileInterceptor`); limite configurável (ex.: 10 MB)
- CSV **não persistido em disco** no MVP — processado em memória; metadados em `ImportBatch`
- `GET /api/imports/options` — modos, parsers, contas/cartões/faturas/categorias ativos
- Importação **síncrona** no MVP; sem fila nem SSE
- `categoryMappings`: `Record<string, categoryId | { create: { name } }>` — chave é o texto do CSV

### 6.2 Vínculo manual pagamento ↔ fatura

Fluxo em `ui/modules/invoices/`:

1. Usuário abre fatura com saldo em aberto
2. Busca débitos na conta que correspondam ao pagamento
3. Vincula um ou mais pagamentos (`POST /api/invoices/:id/payments`)
4. Server recalcula saldo e status derivados

Relação **muitos-para-um**: suporta pagamento parcial e pagamento originado de banco distinto do cartão. Sem casamento automático.

### 6.3 Compra-pai e parcelas

Fluxo em `ui/modules/parent-purchases/`:

1. Usuário seleciona uma ou mais parcelas (lançamentos existentes)
2. Vincula a compra-pai existente (busca) ou cria nova on-the-fly
3. Compra-pai permanece **informacional** — não entra em somas

### 6.4 Visualização e toggle de regime

- Toggle global em `ui/` (competência ↔ caixa) afeta dashboard, gráficos e tabela de lançamentos
- `server/modules/reports/` executa cálculos filtrando por `competenceDate` ou `cashDate`
- Indicadores do período, quebra por categoria, evolução mensal e tabela filtrável (RF-18 a RF-22)

---

## 7. Superfície da API (esboço)

Todas as rotas sob o prefixo global `/api`. DTOs definidos **apenas** em `server/modules/*/`; a UI replica tipos de resposta localmente em `ui/modules/*/`.

### Auth

- `POST /api/auth/login` — usuário/senha → sessão JWT (cookie httpOnly)
- `POST /api/auth/logout` — encerra sessão

### Onboarding

- `GET /api/setup/status` — `{ hasAccounts, hasCards, hasCategories, readyForImport }` — redirect pós-login na UI; `readyForImport` = `hasAccounts || hasCards`

### Contas

- `GET /api/banks` — listar bancos do usuário (ordenados por nome)
- `POST /api/banks` — criar banco (`{ name }`); 409 se nome duplicado no usuário
- `GET /api/accounts` — listar (ativas por padrão); inclui `bank`
- `POST /api/accounts` — criar (`{ label, bankId }`)
- `PATCH /api/accounts/:id` — editar/desativar

### Cartões

- `GET /api/cards` — listar (ativas por padrão); inclui `bank`
- `POST /api/cards` — criar (`{ label, bankId }`)
- `PATCH /api/cards/:id` — editar/desativar
- `GET /api/cards/:cardId/invoices` — listar faturas do cartão
- `POST /api/cards/:cardId/invoices` — criar fatura (usado antes/durante importação)

### Categorias

- `GET /api/categories` — listar (ativas por padrão)
- `POST /api/categories` — criar
- `PATCH /api/categories/:id` — editar/desativar

### Importação (interface web)

- `GET /api/imports/options` — modos, parsers, contas/cartões/faturas/categorias ativos
- `POST /api/imports/preview` — `multipart/form-data`: `importMode` + `accountId` | (`cardId` + `invoiceId`) + `parserId` + `file` → `{ rows, unknownCategories[], summary }`
- `POST /api/imports/confirm` — body JSON: metadados do lote + `categoryMappings` → `{ created, skipped, errors[] }`
- `GET /api/imports` — histórico de importações
- `GET /api/imports/:id` — detalhe de uma importação (opcional no MVP)

### Lançamentos

- `GET /api/transactions` — filtros: período, categoria, origem, `regime`
- `PATCH /api/transactions/:id` — ajustes pontuais (tipo, vínculos)

### Faturas

- `GET /api/invoices` — lista com saldo/status derivados
- `GET /api/invoices/:id` — detalhe + compras + pagamentos vinculados
- `POST /api/invoices/:id/payments` — vincular pagamento(s)

### Compra-pai

- `POST /api/parent-purchases` — criar agregado
- `GET /api/parent-purchases` — listar agregados
- `POST /api/parent-purchases/:id/installments` — vincular parcelas

### Relatórios

- `GET /api/reports/summary?regime=&from=&to=` — totais gasto/receita/saldo (RF-19)
- `GET /api/reports/by-category?regime=&from=&to=` — quebra por categoria (RF-20)
- `GET /api/reports/monthly-evolution?regime=` — evolução mensal (RF-21)

### Health

- `GET /api/health` — única rota pública além de login

---

## 8. Stack e defaults técnicos

| Camada | Escolha | Justificativa |
|--------|---------|---------------|
| Runtime | Node.js 20+ | Alinhado ao PROJECT_DEFINITION §7.1 |
| App host | NestJS (único processo) | Hospeda `/api/**` e serve SPA; modularidade nativa |
| UI | React + Vite | SPA para dashboards e tabelas filtráveis |
| Roteamento | `/api/**` → controllers; `/**` → SPA | Separação lógica clara para split futuro |
| ORM | Prisma | Migrations, tipagem, PostgreSQL — restrito a `server/` |
| DB | PostgreSQL | PROJECT_DEFINITION §7.1 |
| Auth | Passport local + JWT em cookie httpOnly | Simples para usuário único MVP |
| Testes | Jest (`server/`) + Vitest (`ui/`) | TDD nos módulos de domínio, parsers e componentes |
| Orquestração | Docker Compose | App + PostgreSQL |

### Variáveis de ambiente (produção)

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | Conexão PostgreSQL |
| `JWT_SECRET` | Assinatura de tokens |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | Usuário fixo do MVP (seed) |

### Evolução futura

Extrair `src/server/` inteiro para app NestJS standalone e `src/ui/` inteiro para app React/Vite standalone, mantendo contrato HTTP `/api/**`. A estrutura já espelha essa separação; não há `shared/` a desfazer.

---

## 9. Desvios em relação ao PROJECT_DEFINITION

| PROJECT_DEFINITION | Escolha de arquitetura |
|--------------------|------------------------|
| §7.1 "monolito modular" | Um app web TS: `src/server/` (NestJS, `/api/**`) + `src/ui/` (React SPA); módulos espelhados por domínio |
| §7.1 "separação frontend/backend" | Separação física em `server/` e `ui/` no mesmo repo/processo no MVP; extraíveis como apps distintos depois |
| §3.13 usuário fixo | Seed + env vars; sem tela de cadastro de usuários |
| Cadastro de contas/cartões/categorias | Módulos `accounts` e `categories` antes da importação; onboarding obrigatório para origens; categorias recomendadas |
| RF-02 importação | Modo transações/fatura + seleção de Conta ou Cartão+Fatura + parser + preview/confirm com mapeamento de categorias |
| Modelo canônico "será definido no doc técnico" | Interface TypeScript **server-only** em `server/modules/import/` + FK `accountId`/`cardId`/`categoryId` |
| RF-01 / RF-02 importação via UI | Tela web com upload; sem CLI nem importação automática |
| Sem menção a código compartilhado | Tipos de API duplicados na UI; contrato é a API HTTP, não imports TypeScript cross-layer |

Nenhum desvio intencional de regra de negócio — apenas materialização técnica de conceitos abstratos.

---

## 10. Metas não-funcionais

| Meta | Alvo |
|------|------|
| Autenticação | Obrigatória em todas as rotas `/api/**` exceto `/api/auth/login` e `/api/health` |
| Proteção da SPA | Redirect client-side se sessão inválida |
| Multitenant | `userId` em todas as queries desde o MVP |
| Deduplicação | Idempotente em reimportações (RF-04) |
| Idioma da UI | Português |
| Importação web | < 5s para ~1k linhas (meta); UI exibe loading durante o request |
| Validação de upload | Client-side mínima (arquivo, `.csv`, modo, origem, parser); validação completa no server |
| Setup inicial | Redirect para cadastro de contas/cartões se `setup/status` indicar estado vazio; sugestão de categorias quando `hasCategories` false |

---

## 11. Decisões em aberto (próxima iteração)

| Tópico | Notas |
|--------|-------|
| Parsers iniciais | Quais bancos/formatos CSV no primeiro sprint |
| Estratégia de `dedupKey` | Hash de (data + valor + descrição + origem) vs campo do CSV |
| Biblioteca de gráficos | Recharts vs Chart.js para evolução mensal |
| Plugin Vite no NestJS | Integrado vs proxy separado em dev |

---

## 12. Documentos relacionados

| Documento | Propósito |
|-----------|-----------|
| [PROJECT_DEFINITION.MD](./PROJECT_DEFINITION.MD) | Escopo, conceitos e requisitos funcionais do MVP |
| [MVP_EPIC_ROADMAP.md](./MVP_EPIC_ROADMAP.md) | Épicos verticais de implementação (V0–V9) |
| `.cursor/rules/architecture.mdc` | Regra Cursor derivada deste doc |

---

## Histórico do documento

| Data | Alteração |
|------|-----------|
| 2026-09-01 | Versão inicial: app web único, `src/server/` + `src/ui/`, importação via UI, regimes competência/caixa |
| 2026-09-01 | Cadastro de contas/cartões como requisito fundacional; importação por modo com parser; módulo `accounts` |
| 2026-09-02 | Cadastro de categorias (`categories`); `categoryId` em Transaction; importação em duas fases (preview/confirm) com mapeamento |
