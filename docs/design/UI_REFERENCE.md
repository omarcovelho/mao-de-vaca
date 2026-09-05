# Referência de UI — Mão de Vaca

**Status:** Dark theme (mockup + implementação, set/2026)  
**Uso:** Consultar antes de implementar ou refinar telas em `src/ui/`.

## Mockups

| Artefato | Uso |
|----------|-----|
| [dark-theme-mockup.html](./dark-theme-mockup.html) | **Direção atual** — dark theme, shell unificado, criação via modal |
| [mao-de-vaca-ui-mockup.canvas.tsx](./mao-de-vaca-ui-mockup.canvas.tsx) | Mockup light histórico (superseded) |

Abra o HTML no navegador e use os chips no topo para alternar telas.

## Princípios

1. **Calmo e focado** — uma ideia principal por tela; poucos números visíveis de uma vez.
2. **Hierarquia clara** — métrica hero grande; detalhes em texto menor e tons secundários.
3. **Regime sempre acessível** — toggle competência / caixa em pills no cabeçalho das telas que exibem valores.
4. **Ações distinguíveis** — primary / secondary / ghost com contraste no dark; nunca confiar só em texto sem borda/fundo.
5. **Criação em modal** — CTAs no cabeçalho abrem modal; formulários de create/edit **não** ficam embutidos na página (exceto onboarding e wizard de importação).
6. **Listas curtas** — home mostra 3 itens + link “Ver todos”; telas dedicadas para listas completas.

## Layout

| Elemento | Especificação |
|----------|---------------|
| Navegação | Sidebar fixa (~220px), fundo `--bg-elevated` |
| Área de conteúdo | Fundo `--bg`, padding generoso (28–32px) |
| Tipografia | DM Sans; hero ~36px semibold; labels 13–14px |

## Paleta (`src/ui/styles.css`)

| Token | Valor | Uso |
|-------|-------|-----|
| `--bg` | `#12151a` | Fundo da aplicação |
| `--bg-elevated` | `#181c23` | Sidebar |
| `--surface` | `#1e2430` | Cards, modais, painéis |
| `--surface-muted` / `--surface-hover` | `#262d3b` | Hover / seleção |
| `--text` | `#e8eaef` | Texto principal |
| `--text-muted` | `#9aa3b5` | Subtítulos, metadados |
| `--border` / `--border-strong` | `#2c3444` / `#3d4759` | Divisores, inputs |
| `--accent` | `#3d9b6e` | CTA primário, pill ativa |
| `--accent-contrast` | `#0c1210` | Texto sobre accent |
| `--accent-soft` | verde ~16% | Nav ativa, fundos soft |
| `--expense` / `--income` | `#f0a0a0` / `#7dcea0` | Valores signed |

`color-scheme: dark` no `:root`.

## Hierarquia de botões

| Variante | Aparência | Uso |
|----------|-----------|-----|
| `btn--primary` | Verde sólido, texto escuro | CTA único de criação / confirmar |
| `btn--secondary` | Borda visível, fundo transparente | Ação importante na linha (Nova sub, Vincular, Ver) |
| `btn--ghost` | Sem borda; no hover ganha fundo + borda | Ações secundárias (Editar, Cancelar) |
| `btn--danger` | Fundo danger soft + texto danger | Desativar / destrutivo |

## Modais

- Componente: `FormModal` (`src/ui/components/form-modal.tsx`) + `ConfirmModal` para confirmações.
- Contas / cartões / categorias / nova fatura: create (e edit de categoria) via modal.
- **Exceções:** onboarding (formulário inline guiado); importação (wizard multi-etapas na página).

## Navegação

| Rota | Label na sidebar |
|------|------------------|
| `/` | Visão geral |
| `/lancamentos` | Lançamentos |
| `/importar` | Importar |
| `/contas` | Contas |
| `/cartoes` | Cartões |
| `/categorias` | Categorias |
| `/relatorios` | Relatórios |

Login (`/login`) e onboarding ficam fora da sidebar.

## Telas (resumo)

### Login
- Centralizado, sem sidebar; brand com acento verde; card de credenciais.

### Contas / Cartões / Categorias
- Lista limpa + CTA no header → modal.
- Ações de linha com secondary/danger visíveis (não só ghost oculto).

### Cartões — faturas
- “Nova fatura” abre modal (mês + vencimento).

### Importar
- Fluxo permanece na página; criação auxiliar (ex.: fatura) em modal quando aplicável.

## Componentes reutilizáveis

- `AppShell` — sidebar + área principal
- `PageHeader` — título, subtítulo, slot `trailing`
- `FormModal` / `ConfirmModal`
- `RegimeToggle` — pills competência / caixa
- Demais: `TransactionRow`, `CategoryBreakdown`, etc.
