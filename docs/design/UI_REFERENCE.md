# Referência de UI — Mão de Vaca

**Status:** Aprovado como direção visual (mockup interativo, set/2026)  
**Uso:** Consultar antes de implementar ou refinar telas em `src/ui/`.

## Mockup interativo

O mockup completo está em [mao-de-vaca-ui-mockup.canvas.tsx](./mao-de-vaca-ui-mockup.canvas.tsx).

Para visualizar no Cursor: abra o arquivo `.canvas.tsx` na pasta `canvases/` do projeto no IDE (cópia interativa em `~/.cursor/projects/.../canvases/mao-de-vaca-ui-mockup.canvas.tsx`). Use os chips no topo para alternar entre telas.

> O arquivo em `docs/design/` é a **fonte versionada no git**. O canvas no IDE é a cópia interativa — mantenha os dois sincronizados se o mockup evoluir.

## Princípios

1. **Calmo e focado** — uma ideia principal por tela; poucos números visíveis de uma vez.
2. **Hierarquia clara** — métrica hero grande; detalhes em texto menor e tons secundários.
3. **Regime sempre acessível** — toggle competência / caixa em pills no cabeçalho das telas que exibem valores.
4. **Ações secundárias discretas** — botões ghost; CTA primário único por contexto.
5. **Listas curtas** — home mostra 3 itens + link “Ver todos”; telas dedicadas para listas completas.

## Layout

| Elemento | Especificação |
|----------|---------------|
| Navegação | Sidebar fixa (~200px), não header horizontal |
| Área de conteúdo | Fundo quente claro, padding generoso (28–32px) |
| Largura máxima | Conteúdo centralizado; formulários ~360–440px |
| Tipografia | Sans-serif limpa; hero ~36px semibold; labels 13–14px |

## Paleta (planejada para `src/ui/styles.css`)

| Token | Valor | Uso |
|-------|-------|-----|
| `--bg` | `#f7f5f2` | Fundo da aplicação |
| `--surface` | `#ffffff` | Cards, sidebar |
| `--text` | `#1a1a1a` | Texto principal |
| `--text-muted` | `#444` / `#6b6560` | Subtítulos, metadados |
| `--border` | `#e0dcd4` | Divisores, bordas sutis |
| `--accent` | `#2d6a4f` | Links ativos, botão primário, pill ativa |
| `--accent-hover` | `#245a42` | Hover do primário |

## Navegação

| Rota (planejada) | Label na sidebar | Épico |
|------------------|------------------|-------|
| `/` | Visão geral | V7 (relatórios / dashboard) |
| `/lancamentos` | Lançamentos | V5 |
| `/importar` | Importar | V3 / V4 |
| `/contas` | Contas | V2 |
| `/cartoes` | Cartões | V2 / V4 (faturas) |
| `/categorias` | Categorias | V2.5 |
| `/relatorios` | Relatórios | V7 |

Login (`/login`) e onboarding ficam fora da sidebar.

## Telas

### Login
- Centralizado, sem sidebar.
- Logo + tagline; card único com usuário, senha e botão “Entrar”.

### Onboarding
- Dentro do shell com sidebar; conteúdo centralizado.
- Título “Vamos começar”; dois CTAs (conta / cartão) + “Pular por agora”.

### Visão geral (home)
- Cabeçalho: mês/ano + toggle regime.
- **Hero:** valor total do mês (único número grande).
- **Por categoria:** barra de uso + top 3 com percentual e valor.
- **Recentes:** 3 lançamentos + “Ver todos”.

### Lançamentos
- Busca por descrição + filtro de mês.
- Lista simples (descrição, categoria · data, valor); sem tabela densa.

### Importar
- Tipo: pills “Extrato de conta” / “Fatura de cartão”.
- Select de origem (conta ou cartão cadastrado).
- Zona de drag-and-drop para CSV + “Pré-visualizar”.

### Contas
- Apenas contas bancárias (corrente, poupança).
- Cada item: apelido, pill do banco, “Editar”.
- CTA “Adicionar conta” no cabeçalho.

### Cartões
- Seletor de cartão (pills no topo) — um cartão por vez.
- **Hero:** saldo em aberto da fatura atual (aberta ou parcial), com referência e vencimento.
- **Lista de faturas** do cartão selecionado: mês de referência, status (Aberta / Parcial / Quitada), vencimento, total e saldo.
- **Detalhe da fatura** (ao clicar “Ver”): lançamentos da fatura (compras/estornos) + “Vincular pagamento” quando não quitada.
- CTA “Adicionar cartão” no cabeçalho.

Status de fatura derivados do domínio: aberta, parcial, quitada (RN do saldo = compras − estornos − pagamentos vinculados).

### Categorias
- Árvore **compacta e recolhível**: raízes fechadas por padrão; expandir para ver filhos.
- Linha densa com ícone linear minimalista (cor do swatch), nome e tipo só na raiz.
- CTA no cabeçalho: “Nova categoria”. “Nova subcategoria” na linha da categoria/subcategoria (oculto no depth 5).
- Formulário de filha indica o pai (“Em {nome}”); nome, cor, ícone; editar nome/cor/ícone; desativar.
- Banner soft na home quando `hasCategories` é false (recomendado; dismissível).

### Relatórios
- 3 stats em linha (gastos do mês, maior categoria, variação %).
- Gráfico de barras — evolução 6 meses.
- Barra de distribuição por categoria.

## Componentes reutilizáveis (a extrair na implementação)

- `AppShell` — sidebar + área principal
- `PageHeader` — título, subtítulo opcional, slot `trailing` (ex.: regime toggle)
- `RegimeToggle` — pills competência / caixa
- `TransactionRow` — linha de lançamento (descrição, meta, valor)
- `CategoryBreakdown` — usage bar + lista top N
- `InvoiceRow` — linha de fatura (referência, status, vencimento, saldo)
- `CardSelector` — pills para alternar cartão ativo

## Relação com a UI atual

A implementação em `src/ui/` ainda usa header horizontal e telas separadas para contas/cartões. Ao evoluir a UI, migrar gradualmente para este layout — começando pelo shell (sidebar) e tokens CSS, depois tela a tela conforme os épicos forem entregando dados (V5 lançamentos, V7 dashboard/relatórios).
