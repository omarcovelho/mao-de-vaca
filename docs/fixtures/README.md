# Fixtures — Mão de Vaca (V6)

CSVs de exemplo para testar importação de conta, fatura e vínculo de pagamento.

## Arquivos

| Arquivo | Uso |
|---------|-----|
| `fatura-cartao-mes.csv` | Import modo **fatura** (cartão + fatura Ago/2026). Total líquido **R$ 590,15** (compras − estorno). Sem linhas de pagamento. |
| `extrato-conta-corrente.csv` | Import modo **transações** (conta). Inclui débito `Pagamento fatura cartão ago` de **-590,15** em 10/09/2026. |
| `extrato-conta-pagamento-parcial.csv` | Alternativa: dois débitos (-200 + -390,15) para demo de pagamento **parcial** → **quitada**. |

Parser padrão: colunas `data,descricao,valor,categoria` (ou aliases aceitos pelo parser).

## Roteiro rápido

1. Cadastre Conta e Cartão (e use as categorias do seed).
2. Em Cartões → crie fatura **Ago/2026** com vencimento **2026-09-10**.
3. Importe `fatura-cartao-mes.csv` no modo fatura (cartão + fatura). Status **Aberta**, saldo ≈ **-590,15**.
4. Importe `extrato-conta-corrente.csv` no modo transações (conta).
5. Abra a fatura → **Vincular pagamento** → selecione o débito de R$ 590,15 → confirmar → **Quitada**.
6. Em `/lancamentos`, toggle **caixa** no mês **setembro/2026**: compras do cartão aparecem na data do pagamento.
7. Clique no pagamento (origem conta) → abre `/cartoes?invoiceId=…`.

Para parcial: importe `extrato-conta-pagamento-parcial.csv` no lugar do extrato completo (ou só os débitos de pagamento) e vincule primeiro o de R$ 200 (status **Parcial**), depois o restante.
