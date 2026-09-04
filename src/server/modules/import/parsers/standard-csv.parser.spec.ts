import { parseStandardCsv } from './standard-csv.parser';

function csv(text: string): Buffer {
  return Buffer.from(text, 'utf8');
}

describe('standard CSV parser', () => {
  it('maps negative amounts to EXPENSE and positive to INCOME', () => {
    const result = parseStandardCsv(
      csv(`data,descricao,valor,categoria
2026-01-15,Supermercado,-120.50,Alimentação
2026-01-20,Salário,3500.00,Salário
`),
    );

    expect(result.errors).toEqual([]);
    expect(result.transactions).toEqual([
      expect.objectContaining({
        line: 2,
        competenceDate: '2026-01-15',
        cashDate: '2026-01-15',
        description: 'Supermercado',
        amount: '-120.50',
        type: 'EXPENSE',
        category: 'Alimentação',
      }),
      expect.objectContaining({
        line: 3,
        competenceDate: '2026-01-20',
        amount: '3500.00',
        type: 'INCOME',
        category: 'Salário',
      }),
    ]);
  });

  it('parses Brazilian amounts and DD/MM/YYYY dates', () => {
    const result = parseStandardCsv(
      csv(`data,descricao,valor,categoria
15/01/2026,Farmácia,"-1.234,56",Saúde
`),
    );

    expect(result.errors).toEqual([]);
    expect(result.transactions[0]).toMatchObject({
      competenceDate: '2026-01-15',
      amount: '-1234.56',
      type: 'EXPENSE',
    });
  });

  it('ignores tipo=transferencia and keeps sign-based EXPENSE/INCOME', () => {
    const result = parseStandardCsv(
      csv(`data,descricao,valor,categoria,tipo
2026-01-16,PIX para Nubank,-1000.00,Transferência,transferencia
2026-01-16,PIX da Itaú,1000.00,Transferência,TRANSFERÊNCIA
`),
    );

    expect(result.errors).toEqual([]);
    expect(result.transactions[0]).toMatchObject({
      type: 'EXPENSE',
      amount: '-1000.00',
    });
    expect(result.transactions[1]).toMatchObject({
      type: 'INCOME',
      amount: '1000.00',
    });
  });

  it('records row errors for zero amount, bad date, and missing fields', () => {
    const result = parseStandardCsv(
      csv(`data,descricao,valor,categoria
2026-01-15,Zero,0,Alimentação
not-a-date,X,-10,Alimentação
2026-01-15,,-10,Alimentação
`),
    );

    expect(result.transactions).toEqual([]);
    expect(result.errors.map((e) => e.line)).toEqual([2, 3, 4]);
  });

  it('rejects a file without required headers', () => {
    expect(() =>
      parseStandardCsv(csv(`foo,bar\n1,2\n`)),
    ).toThrow(/cabeçalho/i);
  });

  it('parses amounts with space after the minus sign', () => {
    const result = parseStandardCsv(
      csv(`data,descricao,valor,categoria
2026-08-17,Compra,"- 1.234,56",Alimentação
`),
    );

    expect(result.errors).toEqual([]);
    expect(result.transactions[0]).toMatchObject({
      amount: '-1234.56',
      type: 'EXPENSE',
    });
  });

  describe('invoice mode', () => {
    it('maps negative to EXPENSE compra and positive to EXPENSE estorno', () => {
      const result = parseStandardCsv(
        csv(`date,title,amount
2026-08-31,Pao de Acucar,"-19,90"
2026-08-30,Estorno Apple,"9,90"
`),
        { mode: 'invoice' },
      );

      expect(result.errors).toEqual([]);
      expect(result.transactions).toEqual([
        expect.objectContaining({
          description: 'Pao de Acucar',
          amount: '-19.90',
          type: 'EXPENSE',
          cashDate: null,
          category: '(sem categoria)',
        }),
        expect.objectContaining({
          description: 'Estorno Apple',
          amount: '9.90',
          type: 'EXPENSE',
          cashDate: null,
          category: '(sem categoria)',
        }),
      ]);
    });

    it('accepts English headers and optional categoria', () => {
      const result = parseStandardCsv(
        csv(`date,title,amount,categoria
2026-08-15,Mercado,-100.00,Alimentação
`),
        { mode: 'invoice' },
      );

      expect(result.errors).toEqual([]);
      expect(result.transactions[0]).toMatchObject({
        category: 'Alimentação',
        amount: '-100.00',
        type: 'EXPENSE',
      });
    });

    it('does not require categoria header', () => {
      expect(() =>
        parseStandardCsv(
          csv(`date,title,amount
2026-08-15,Mercado,-10.00
`),
          { mode: 'invoice' },
        ),
      ).not.toThrow();
    });
  });
});
