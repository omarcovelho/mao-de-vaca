# Fixtures — set/2026 (Não-despesa + transferências)

CSVs do **mês corrente (set/2026)** para testar:

1. Transferência entre contas (vínculo manual)
2. Aplicação / resgate (reclassificação sem vínculo)
3. Pagamento de fatura (categoria automática no vínculo)

Todas as linhas usam categorias **EXPENSE/INCOME** do seed (`A revisar`, `Salário`, etc.). Categorias `Não-despesa` **não** vêm do CSV — só na UI.

## Arquivos

| Arquivo | Destino | Destaques |
|---------|---------|-----------|
| `2026-09-conta-corrente.csv` | Conta corrente (modo transações) | PIX **-1.200** (05/09); Aplicação CDB **-2.000** (08/09); Pagamento fatura **-590,15** (10/09) |
| `2026-09-conta-poupanca.csv` | Conta poupança | PIX **+1.200** (05/09); Resgate CDB **+500** (15/09) |
| `2026-09-fatura-cartao.csv` | Cartão, fatura **Ago/2026** (venc. 10/09) | Total líquido **-590,15** (igual ao débito de pagamento) |
| `2026-01-fatura-cartao.csv` | Cartão, fatura **Jan/2026** (venc. sugerido 10/02) | Para testar **Nova fatura** em `/importar` |

Fixtures V6 antigas (`extrato-conta-corrente.csv`, `fatura-cartao-mes.csv`, …) permanecem como referência legada.

## Roteiro

1. Seed / login; cadastre **Conta corrente**, **Conta poupança** e **Cartão**.
2. Em Cartões → crie fatura **Ago/2026**, vencimento **2026-09-10**.
3. Importe `2026-09-fatura-cartao.csv` (modo fatura → cartão + fatura).
4. Importe `2026-09-conta-corrente.csv` na corrente e `2026-09-conta-poupanca.csv` na poupança.
5. **Transferência:** `/lancamentos` (set/2026) → altere categoria do PIX -1.200 para **Transferências entre contas** → no modal, busque por valor e vincule o +1.200. Ambos viram `TRANSFER` e saem dos relatórios.
6. **Investimento:** classifique Aplicação -2.000 e Resgate +500 como **Aplicações/resgates** (sem vínculo). Continuam em lançamentos; fora dos totais.
7. **Pagamento:** fatura → Vincular pagamento → débito -590,15 → tipo `INVOICE_PAYMENT` e categoria **Pagamento de fatura** automáticos; fatura quitada.

Parser padrão: `data,descricao,valor,categoria` (aliases aceitos).
