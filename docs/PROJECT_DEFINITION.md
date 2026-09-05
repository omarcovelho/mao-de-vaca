# Requisito de MVP — Software Pessoal de Controle de Gastos

> Documento **conceitual e comportamental**. Descreve o *quê* e o *porquê* do sistema: conceitos, regras de negócio, escopo, requisitos funcionais e arquitetura em alto nível. Não define esquema de dados, tabelas ou contratos de código — isso será derivado posteriormente em um documento técnico.

---

## 1. Visão geral

Aplicação web pessoal para controle de gastos e receitas a partir da importação de extratos e faturas bancárias. O diferencial central do sistema é permitir enxergar os gastos sob **dois regimes simultâneos** — competência e caixa — de modo que o usuário saiba quanto gastou economicamente em um mês, mesmo quando o pagamento efetivo (por exemplo, de uma fatura de cartão) ocorra em outro momento.

Antes de qualquer importação ou operação de dados, o usuário **cadastra suas contas bancárias, cartões de crédito e categorias** — entidades fundacionais às quais todos os lançamentos, faturas e importações ficam vinculados.

O acesso é protegido por autenticação (usuário e senha). No MVP o sistema opera com **um único usuário fixo**, provisionado na configuração inicial; o modelo de dados, porém, já nasce **preparado para múltiplos tenants**, em que **cada usuário é um tenant** e é dono dos próprios dados (ver seção 3.13). A ativação efetiva do multitenant fica para versões futuras.

O sistema é alimentado por arquivos CSV que chegam **já pré-categorizados** por uma ferramenta externa — o nome da categoria vem no arquivo; o app mantém o **cadastro de categorias** como dado mestre e resolve o vínculo na importação. A **categorização automática** (decidir a categoria de um lançamento) não faz parte do escopo deste software.

---

## 2. Objetivos

- Permitir o **cadastro de contas bancárias, cartões de crédito e categorias** como base de todas as operações — requisito anterior a importação, lançamentos e relatórios.
- Importar lançamentos financeiros a partir de arquivos CSV de múltiplas fontes (extratos de conta e faturas de cartão), vinculados às contas e cartões cadastrados.
- Registrar cada lançamento de forma que ele possa ser analisado tanto em **regime de competência** quanto em **regime de caixa**.
- Modelar corretamente o ciclo do cartão de crédito (compra, parcelamento, fatura, pagamento, estorno) sem contagem duplicada de gastos.
- Oferecer visualizações de gastos: indicadores do período, quebra por categoria e evolução ao longo do tempo.
- Manter a camada de importação abstraída, de modo que novos formatos de arquivo possam ser suportados no futuro sem impacto no restante do sistema.

---

## 3. Glossário de conceitos

Esta seção é o núcleo do documento. As regras funcionais das seções seguintes derivam destes conceitos.

### 3.1 Regime de competência
Reconhece o gasto no momento em que ele **acontece economicamente** — a data da compra. É a resposta para "quanto eu efetivamente consumi neste mês", independentemente de quando o dinheiro sai da conta.

### 3.2 Regime de caixa
Reconhece o gasto no momento em que o **dinheiro efetivamente sai da conta**. Responde a "quanto de dinheiro saiu do meu bolso neste mês".

No sistema, o regime de caixa é **dirigido por eventos de saída real de dinheiro**, e não pela compra individual:
- **Gastos de débito/conta**: a saída de caixa ocorre na própria data do lançamento (competência e caixa coincidem).
- **Gastos de cartão**: a saída de caixa **não** é atribuída à compra individual. O evento de caixa é o **pagamento da fatura**, na data em que o pagamento efetivamente ocorre.

Consequência importante e desejada: se o pagamento de uma fatura ainda não foi importado/registrado, as compras daquela fatura aparecem no regime de **competência**, mas ainda **não** aparecem no regime de **caixa** — porque, de fato, o dinheiro ainda não saiu. A completude do regime de caixa depende de manter os pagamentos de fatura registrados.

### 3.3 Lançamento
Unidade básica do sistema. Cada lançamento possui:
- uma **data de competência** (quando o gasto aconteceu economicamente);
- uma **data de caixa** (quando o dinheiro sai/saiu), quando aplicável;
- uma descrição, um valor e, **opcionalmente**, uma **categoria** folha cadastrada (ver §3.6; o nome chega pré-atribuído no CSV por ferramenta externa; ausência = “sem categoria”, ainda contabilizada como despesa/receita);
- a identificação de sua **origem** — uma **Conta** ou **Cartão** cadastrado (ver §3.4 e §3.5);
- um **tipo** (ver 3.7).

Para lançamentos de conta/débito, competência e caixa coincidem. Para lançamentos de cartão, a competência é a data da compra e o evento de caixa provém do pagamento da fatura correspondente.

### 3.4 Conta
Conta bancária de movimentação (corrente, poupança etc.). **Entidade fundacional** — todo extrato importado e todo débito de pagamento de fatura referencia uma Conta cadastrada.

- Pertence ao usuário-dono.
- Atributos conceituais: **apelido** (ex.: "Nubank PJ") e **Banco** cadastrado (§3.4b).
- Origem de extratos importados no modo **transações** e de débitos de pagamento de fatura.
- Não possui faturas.

### 3.4b Banco
Instituição financeira associada a contas e cartões. **Catálogo por usuário**.

- Pertence ao usuário-dono; nome único por usuário.
- No MVP, o seed provisiona bancos comuns: Nubank, Itaú, Inter, Sofisa, Daycoval.
- O usuário pode **cadastrar um banco novo** quando a instituição não estiver na lista.
- Conta e Cartão referenciam um Banco (não há texto livre de instituição).

### 3.5 Cartão
Cartão de crédito. **Entidade fundacional** — toda fatura e toda compra/estorno importado de fatura referencia um Cartão cadastrado.

- Pertence ao usuário-dono.
- Atributos conceituais: **apelido** e **Banco** emissor cadastrado (§3.4b).
- Agrega **Faturas** (§3.8); o banco do cartão substitui a noção de banco solto nas faturas.

### 3.6 Categoria
Classificação analítica dos lançamentos (ex.: "Alimentação" → "Supermercado"). **Entidade fundacional** — todo lançamento referencia uma **folha** da árvore de categorias cadastrada (nó sem filhos).

- Pertence ao usuário-dono.
- Forma uma **árvore** via categoria pai (`parentId`); profundidade máxima **5** (raiz = 1).
- Atributos conceituais: **nome**, **cor** (`#RRGGBB`), **ícone** (chave de catálogo fixo), **tipo** (`gasto` / `renda` / `não-despesa` — definido na raiz e herdado pelos filhos).
- O usuário pode **alterar nome, cor e ícone**; o tipo permanece imutável após a criação.
- Nome único entre irmãos; nomes de folhas únicos por usuário (para mapeamento na importação).
- O nome chega no CSV pela ferramenta externa de categorização; na importação, o sistema **mapeia** o texto do CSV para a **folha** correspondente ou permite **criar** uma nova na pré-visualização.
- Categorias desativadas não aparecem em novos mapeamentos; lançamentos históricos permanecem. Desativar um nó desativa a subárvore.

### 3.7 Tipos de lançamento
Três tipos, com semântica distinta:

- **Despesa** — reduz o saldo; é gasto de fato. Entra nos totais de gasto e na quebra por categoria.
- **Receita** — aumenta o saldo; é renda de fato (ex.: salário). Entra nos totais de entrada.
- **Transferência** — movimenta caixa, mas **não** é gasto nem renda. Não entra em nenhum total de despesa nem de receita. Cobre os casos em que o dinheiro apenas muda de lugar. Possui dois usos:
  - **Pagamento de fatura** (transferência especializada, vinculável a uma fatura — ver 3.9);
  - **Investimento** (aporte/resgate — ver 3.11);
  - e, de forma geral, qualquer movimentação entre as próprias contas do usuário.

**Transferência entre contas próprias no extrato:** o mesmo movimento costuma aparecer em **dois CSVs** — por exemplo, saída na Itaú como valor negativo (despesa no parser) e entrada na Nubank como valor positivo (receita). Cada arquivo é importado de forma independente; o usuário **vincula manualmente** as duas pernas em `/lancamentos` ao classificar como **Transferências entre contas** (modal de busca por valor). A importação **não** atribui categorias Não-despesa.

Essa distinção é o que impede a **contagem duplicada**: as compras de cartão já são reconhecidas como despesa item a item na fatura; o pagamento da fatura, sendo transferência, move o caixa sem reintroduzir o gasto.

### 3.8 Fatura (como passivo)
A fatura de cartão é modelada como um **passivo** — uma dívida com a operadora do cartão. É uma entidade própria, vinculada a um **Cartão** cadastrado (§3.5), identificada por **mês de referência** e **data de vencimento** (a instituição é derivada do cartão).

- As **compras** de cartão (incluindo cada parcela) **aumentam** o total da fatura.
- Os **estornos** **reduzem** o total da fatura (ver 3.10).
- Os **pagamentos** vinculados **reduzem** o saldo em aberto (ver 3.9).

O **saldo da fatura** é derivado:

```
saldo_fatura = (compras − estornos) − pagamentos_vinculados
```

A partir do saldo, a fatura possui um **status derivado**:
- **Em aberto** — nenhum pagamento vinculado;
- **Parcialmente paga** — pago maior que zero e menor que o total líquido;
- **Quitada** — pago maior ou igual ao total líquido.

Para pessoa física, o cartão de crédito é essencialmente o único passivo relevante: todos os demais gastos são pagos no momento da compra. Por isso a fatura é modelada como um conceito de primeira classe específico, em vez de um plano de contas genérico de partidas dobradas.

### 3.9 Pagamento de fatura
Lançamento de primeira classe do tipo **transferência**, com semântica específica:
- indica de **qual Conta** cadastrada o dinheiro saiu (pode ser instituição diferente do cartão — ex.: pagar a fatura do banco A debitando da conta do banco B; isso é suportado naturalmente);
- pode ser **vinculado manualmente** a uma fatura, quitando-a total ou parcialmente;
- **não** é despesa — não entra em nenhum total de gasto, em nenhum regime.

O pagamento é o **evento que gera a saída de caixa** das compras daquela fatura. Portanto, o regime de caixa das compras de cartão é intrinsecamente ancorado na **data do pagamento real**, e não no vencimento da fatura (o vencimento é apenas uma informação da fatura, útil para localizar os débitos correspondentes).

**Vínculo pagamento ↔ fatura:**
- É **manual**. O usuário abre uma fatura, vê o saldo em aberto e procura, na conta, débitos que correspondam a esse pagamento, vinculando-os.
- A relação é **muitos-para-um**: uma fatura pode ser quitada por **vários** pagamentos, o que dá suporte a **pagamento parcial** (ex.: parte no vencimento, parte depois).
- Não há dedução nem casamento automático.

### 3.10 Estorno
Estorno de compra no cartão (cancelamento, devolução, compra não reconhecida) é tratado como um **lançamento de sinal oposto** ao da compra — nada além disso. Não é um caso especial no sistema:
- entra como **mais um item** na fatura **em que apareceu**, reduzindo o total daquela fatura;
- é categorizado como qualquer lançamento (a categoria correta chega pré-atribuída no CSV), abatendo o gasto da categoria correspondente;
- é absorvido automaticamente pela fórmula do saldo da fatura;
- **não** é tratado como receita — é despesa negativa, não entrada de dinheiro.

Comportamentos deliberadamente **fora do escopo**:
- não há retroação de competência (o estorno conta no período/fatura em que apareceu, ainda que a compra original seja de outro mês);
- não há casamento automático com a compra original;
- não há cancelamento automático de parcelas futuras.

O estorno pode ser **vinculado manualmente** a uma compra-pai (ver 3.12), se o usuário desejar, mas isso nunca é obrigatório.

### 3.11 Investimento
Retirada de dinheiro da conta para investimento (aporte) é uma **transferência**: o dinheiro sai do caixa, mas o patrimônio não diminuiu — apenas mudou de forma. Portanto:
- **afeta o regime de caixa** (o dinheiro saiu da conta no mês do aporte);
- **não** é despesa (não entra em nenhum total de gasto);
- um eventual resgate é outra transferência, com o dinheiro voltando ao caixa; **não** é receita.

**Fora do escopo:** o sistema não controla rendimento, posição, custo ou performance de investimentos. Isso é responsabilidade de outra ferramenta. O app apenas reconhece a movimentação de caixa.

### 3.12 Compra-pai (agregado de compra parcelada)
Uma compra parcelada é registrada de forma **distribuída**: cada parcela é um **lançamento próprio**, e é a parcela que efetivamente entra nas somas — na competência, na data da compra; no caixa, via pagamento da fatura em que a parcela caiu.

A **compra-pai** é um **agregado puramente informacional**:
- reúne informações da compra original (descrição original, valor total, número de parcelas, data da compra);
- serve para o usuário enxergar que um conjunto de parcelas pertence à mesma compra;
- **não é contabilizada** — não entra em nenhuma soma. Se entrasse junto com as parcelas, reintroduziria contagem duplicada.

**Vínculo parcela ↔ compra-pai:**
- É **manual**. O usuário seleciona uma ou mais parcelas e as vincula a uma compra-pai **existente** (por busca) ou **cria uma nova na hora** (on-the-fly).
- Não há dedução automática a partir da descrição (ex.: "5/12").
- Lançamentos à vista simplesmente não possuem compra-pai.

### 3.13 Usuário e tenant
O acesso ao sistema é protegido por **autenticação com usuário e senha**.

O modelo é concebido como **multitenant**, em que **cada usuário é um tenant** e é o **dono** dos próprios dados: toda entidade do domínio (contas, cartões, categorias, lançamentos, faturas, compras-pai, importações) pertence a um usuário, e as consultas consideram esse vínculo de propriedade.

No MVP, porém, o sistema opera com **um único usuário fixo**, provisionado na **configuração inicial** — não há tela de cadastro público nem gestão de usuários. A preparação multitenant é estrutural (o domínio já carrega a noção de dono e as consultas já filtram por ele), mas o suporte efetivo a múltiplos usuários — cadastro de usuários, gestão de tenants e isolamento ativo — fica para versões futuras. O objetivo dessa preparação é evitar uma migração custosa quando o multiusuário for ativado.

---

## 4. Escopo

### 4.1 Dentro do escopo (MVP)
- **Cadastro de contas, cartões e categorias** via interface web (listagem, criação, edição e desativação) — **requisito fundacional, anterior a importação e demais fluxos de dados**.
- **Mapeamento de categorias na importação** — pré-visualização do CSV com resolução de categorias desconhecidas (mapear para existente ou criar nova).
- Importação de CSV vinculada a **Conta** ou **Cartão** cadastrado, com seleção de modo (transações ou fatura), fatura de destino quando aplicável, e parser (padrão no MVP).
- Camada de importação abstraída por um **modelo canônico** único.
- **Deduplicação** de lançamentos para evitar duplicidade em reimportações ou meses sobrepostos.
- Registro de lançamentos com os dois regimes (competência e caixa).
- Modelagem de fatura como passivo vinculada a cartão cadastrado, com saldo e status derivados.
- Pagamento de fatura como lançamento de primeira classe, com vínculo manual (muitos-para-um, suportando pagamento parcial e débito de conta distinta do cartão).
- Estorno como lançamento de sinal oposto.
- Compra-pai como agregado informacional com vínculo manual.
- Receitas e transferências (incluindo investimentos).
- Visualizações: toggle de regime, indicadores do período, quebra por categoria, evolução mensal e tabela de lançamentos filtrável.
- Autenticação com usuário e senha, com **um usuário fixo** provisionado na configuração inicial.
- Modelo de dados preparado para multitenant (cada usuário é dono dos próprios dados), com o suporte a múltiplos usuários inativo no MVP.

### 4.2 Fora do escopo (MVP)
- Categorização automática de lançamentos (decisão feita por ferramenta externa; o app apenas recebe o nome no CSV e valida/mapeia para categoria cadastrada).
- Detecção automática de banco/tipo de arquivo ou de conta na importação.
- Dedução automática de parcelamento a partir da descrição.
- Casamento/dedução automática de pagamento ↔ fatura, ou estorno ↔ compra original.
- Retroação de competência de estornos; cancelamento automático de parcelas futuras.
- Controle de investimentos: rendimento, posição, custo, performance.
- Orçamentos, metas, comparação competência × caixa lado a lado, e multi-moeda.
- Sincronização automática com banco; saldo em tempo real da conta.
- Cadastro público e gestão de usuários; múltiplos usuários ativos; isolamento efetivo entre tenants.

---

## 5. Requisitos funcionais

### 5.0 Autenticação e acesso
- **RF-00a** — O acesso ao sistema exige autenticação com usuário e senha.
- **RF-00b** — No MVP existe um único usuário fixo, provisionado na configuração inicial; não há cadastro público nem gestão de usuários.
- **RF-00c** — Toda entidade do domínio pertence a um usuário-dono, e as operações do sistema consideram esse vínculo de propriedade, ainda que haja um só usuário no MVP.

### 5.1 Contas e cartões
- **RF-00d** — O usuário cadastra contas bancárias (apelido e **Banco** cadastrado).
- **RF-00e** — O usuário cadastra cartões de crédito (apelido e **Banco** cadastrado).
- **RF-00d1** — O sistema mantém um catálogo de bancos por usuário; no MVP, o seed inclui Nubank, Itaú, Inter, Sofisa e Daycoval.
- **RF-00d2** — O usuário pode cadastrar um banco adicional quando a instituição não existir na lista (nome único por usuário).
- **RF-00f** — O usuário lista, edita e pode desativar contas e cartões; entidades com lançamentos vinculados não são removidas fisicamente no MVP (desativação).
- **RF-00g** — O sistema impede importação e demais entradas de dados enquanto não existir ao menos uma conta ou cartão cadastrado, conforme o modo exigido.
- **RF-00h** — Após o login, o sistema orienta o usuário ao cadastro de contas/cartões quando ainda não houver nenhum cadastrado (estado vazio).

### 5.1b Categorias
- **RF-00i** — O usuário cadastra categorias em árvore (nome, cor, ícone; tipo na raiz) e pode **alterar nome, cor e ícone**.
- **RF-00j** — O usuário lista, edita e pode desativar categorias; categorias com lançamentos vinculados não são removidas fisicamente no MVP (desativação).
- **RF-00k** — Após o login, o sistema orienta ao cadastro de categorias quando a lista estiver vazia (recomendado; **não bloqueia** importação).

### 5.2 Importação
- **RF-01** — O usuário importa lançamentos a partir de um arquivo CSV pela interface web.
- **RF-02a** — O usuário escolhe o **modo de importação**: transações (extrato de conta) ou fatura (fatura de cartão).
- **RF-02b** — No modo **transações**, seleciona uma **Conta** cadastrada.
- **RF-02c** — No modo **fatura**, seleciona um **Cartão** cadastrado e a **Fatura** de destino (existente ou criada na hora).
- **RF-02d** — Após selecionar origem, o usuário escolhe o **parser** a aplicar; no MVP existe um parser padrão.
- **RF-02e** — Na **pré-visualização** da importação, o sistema lista categorias do CSV ainda não cadastradas e permite **mapear** para categoria existente ou **criar** nova antes de confirmar a persistência.
- **RF-03** — Cada parser converte o arquivo para o **modelo canônico** interno do sistema, comum a todas as fontes.
- **RF-04** — O sistema evita duplicidade de lançamentos em reimportações ou períodos sobrepostos, por meio de um mecanismo de deduplicação.
- **RF-05** — Novos parsers podem ser adicionados no futuro sem impacto sobre o restante do sistema.

### 5.3 Lançamentos e regimes
- **RF-06** — Cada lançamento é registrado com data de competência e, quando aplicável, data de caixa.
- **RF-07** — Cada lançamento possui um tipo: despesa, receita ou transferência.
- **RF-07a** — Categorias **Não-despesa** de sistema (Pagamento de fatura, Transferências entre contas, Aplicações/resgates) são obrigatórias para todo usuário; a importação CSV nunca as atribui — só reclassificação manual (ou vínculo de fatura).
- **RF-07b** — Ao classificar como Transferências entre contas, o usuário vincula a outra perna (sinais opostos, mesmo valor absoluto); ambos ficam `TRANSFER` e fora dos relatórios.
- **RF-07c** — Ao classificar como Aplicações/resgates, o lançamento vira `TRANSFER` sem vínculo e permanece listável, fora dos totais.
- **RF-08** — O sistema apresenta os lançamentos alternando entre regime de competência e regime de caixa.
- **RF-09** — No regime de caixa, gastos de débito/conta são reconhecidos na própria data; gastos de cartão são reconhecidos pelos eventos de pagamento de fatura.

### 5.4 Fatura, pagamento e estorno
- **RF-10** — Faturas pertencem a um **Cartão** cadastrado (mês de referência, vencimento).
- **RF-11** — O saldo e o status (em aberto, parcialmente paga, quitada) da fatura são derivados de suas compras, estornos e pagamentos vinculados.
- **RF-12** — O usuário vincula manualmente um ou mais pagamentos a uma fatura; o débito ocorre em **Conta** cadastrada e a fatura pertence a **Cartão** cadastrado, suportando pagamento parcial e débito de instituição distinta do cartão; o lançamento recebe automaticamente a categoria **Pagamento de fatura**.
- **RF-12a** — O usuário pode **desvincular** um pagamento de uma fatura; o débito volta a ser despesa (ou receita) de conta; a categoria anterior é restaurada se a folha ainda existir e estiver ativa, senão o lançamento fica **sem categoria** (`categoryId` null); o caixa das compras da fatura é recalculado (sem pagamentos restantes → `cashDate` null).
- **RF-13** — Pagamentos de fatura e investimentos são registrados como transferências e não entram em nenhum total de gasto ou de receita.
- **RF-14** — Estornos são registrados como lançamentos de sinal oposto, na fatura em que apareceram, e podem ser vinculados manualmente a uma compra-pai.

### 5.5 Compra parcelada
- **RF-15** — Compras parceladas são registradas de forma distribuída, com uma parcela por lançamento.
- **RF-16** — O usuário vincula manualmente parcelas a uma compra-pai existente ou cria uma compra-pai na hora.
- **RF-17** — A compra-pai é informacional e não é contabilizada em nenhuma soma.

### 5.6 Visualização
- **RF-18** — A interface possui um **toggle de regime** (competência ↔ caixa) que afeta toda a visualização.
- **RF-19** — O sistema exibe **indicadores do período**: total de gastos, total de receitas e saldo.
- **RF-20** — O sistema exibe a **quebra de gastos por categoria**, com percentual do total; despesas **sem categoria** entram no total e aparecem como fatia sintética “Sem categoria” (não é um cadastro de categoria).
- **RF-21** — O sistema exibe a **evolução mensal** dos gastos ao longo do tempo.
- **RF-22** — O sistema exibe uma **tabela de lançamentos filtrável** por período, categoria e origem (conta ou cartão).

---

## 6. Regras de negócio (síntese)

- **RN-08** — Conta ou cartão cadastrado é **pré-requisito** de qualquer importação; o sistema rejeita importação sem origem válida.
- **RN-09** — Conta e cartão desativados não aparecem para nova importação, mas lançamentos históricos permanecem.
- **RN-10** — Fatura só pode existir vinculada a cartão cadastrado; não há fatura órfã de cartão.
- **RN-11** — Categoria com lançamentos vinculados não é removida fisicamente; apenas desativada (`active: false`).
- **RN-12** — Toda importação só persiste após resolver 100% das **categorias nomeadas** do lote (mapeamento ou criação na pré-visualização). Um lançamento **pode** existir sem categoria (`categoryId` null) fora desse fluxo (ex.: após desvincular pagamento cuja folha anterior foi desativada).
- **RN-13** — Categorias desativadas não aparecem em novos mapeamentos; lançamentos históricos permanecem (podem ficar sem categoria se a folha for desativada e o vínculo anterior for desfeito).
- **RN-01** — Saldo = receitas − despesas. Transferências não afetam o total de gasto nem o de receita.
- **RN-02** — O pagamento de fatura nunca é contabilizado como despesa; a despesa já foi reconhecida nas compras da fatura. Isso impede contagem duplicada.
- **RN-03** — A compra-pai nunca é contabilizada; apenas as parcelas entram nas somas.
- **RN-04** — O estorno é despesa negativa, nunca receita, e conta na fatura/período em que apareceu.
- **RN-05** — O investimento é transferência: afeta o caixa, não afeta o gasto nem a receita; rendimento não é rastreado.
- **RN-06** — No regime de caixa, o gasto de cartão é reconhecido pela data do pagamento real da fatura, não pelo vencimento.
- **RN-07** — A completude do regime de caixa para gastos de cartão depende de os pagamentos de fatura estarem registrados e vinculados.

---

## 7. Arquitetura em alto nível

Aplicação organizada como **monolito modular**, com separação clara entre frontend e backend e módulos internos por responsabilidade dentro de cada camada.

### 7.1 Stack
- **Backend:** Node.js com **NestJS** — escolhido pela aderência natural a uma organização modular (módulos, injeção de dependência e separação de camadas bem definidas), o que favorece a manutenção e a evolução da camada de importação.
- **Frontend:** React.
- **Banco de dados:** PostgreSQL.
- **Orquestração:** docker compose, executando a aplicação e o banco.

### 7.2 Módulos (responsabilidades)
- **Autenticação / acesso** — login com usuário e senha; identifica o usuário-dono das operações. No MVP, opera com o usuário fixo provisionado na configuração.
- **Contas e cartões** — CRUD de contas bancárias e cartões de crédito; **primeiro módulo de domínio** após autenticação. Importação, faturas e lançamentos dependem dele.
- **Categorias** — CRUD de categorias; **anterior à importação** (épico dedicado no roadmap). Lançamentos e relatórios referenciam categorias cadastradas.
- **Importação** — recebe o arquivo, a conta ou cartão selecionado, a fatura quando aplicável, e o parser; pré-visualiza o lote, resolve mapeamento de categorias e confirma a persistência.
- **Mecanismos de importação (parsers)** — conversores de CSV para o **modelo canônico** comum; no MVP, um parser padrão. Extensível por novos parsers sem tocar no restante.
- **Domínio / contabilização** — regras de tipos de lançamento, regimes, fatura como passivo, saldo e status, compra-pai, deduplicação.
- **Consultas / relatórios** — cálculos por período e por regime, quebras por categoria, evolução mensal.
- **API** — expõe as operações ao frontend.

### 7.3 Camada de importação como contrato conceitual
A abstração central do sistema: **todo parser produz lançamentos no mesmo modelo canônico interno**, vinculados à Conta ou Cartão selecionado na importação. Adicionar suporte a um novo layout significa implementar um novo parser que satisfaça esse contrato; nenhum outro módulo é afetado. O modelo canônico descreve, em nível conceitual, os atributos essenciais de um lançamento (datas de competência e caixa, descrição, valor, tipo, **nome de categoria** vindo do CSV — resolvido para categoria cadastrada na confirmação —, vínculo com conta ou cartão, referência de fatura quando aplicável, e um identificador para deduplicação).

> A materialização deste modelo canônico em estruturas de dados concretas será definida no documento técnico.

---

## 8. Evoluções futuras (registro)

Itens conscientemente deixados de fora do MVP, candidatos a versões futuras:
- Parcelamento com **reconhecimento integral na compra** (a compra é reconhecida por inteiro na competência da data da compra, com o caixa distribuído pelas faturas seguintes), como alternativa ao registro distribuído por parcela adotado no MVP.
- Dedução automática de parcelamento, e casamento automático de pagamento ↔ fatura e estorno ↔ compra original.
- Vínculo **manual** entre lançamentos que representam as duas pernas de uma transferência entre contas próprias (importadas em arquivos distintos).
- Retroação de competência de estornos.
- Controle de investimentos (rendimento, posição, performance).
- Orçamentos e metas; comparação competência × caixa lado a lado; multi-moeda.
- Detecção automática de banco/tipo de arquivo na importação.
- Ativação do multitenant: cadastro e gestão de usuários, múltiplos usuários ativos e isolamento efetivo entre tenants.