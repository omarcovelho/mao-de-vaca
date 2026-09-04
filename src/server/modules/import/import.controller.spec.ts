import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';

function getSetCookie(headers: Record<string, unknown>): string[] {
  const raw = headers['set-cookie'];
  if (Array.isArray(raw)) {
    return raw as string[];
  }
  if (typeof raw === 'string') {
    return [raw];
  }
  return [];
}

function cookieHeaderFromSetCookie(setCookieHeaders: string[]): string {
  return setCookieHeaders.map((header) => header.split(';')[0]).join('; ');
}

const CSV = `data,descricao,valor,categoria
2026-01-15,Supermercado Extra,-120.50,Alimentação
2026-01-20,Salário,3500.00,Salário
2026-01-16,PIX para Nubank,-1000.00,Lazer
`;

const CSV_LINES = [2, 3, 4];

const DUPLICATE_CSV = `data,descricao,valor,categoria
2026-01-06,NuTag*RHG9B72,-12.00,Alimentação
2026-01-06,NuTag*RHG9B72,-5.40,Alimentação
2026-01-06,NuTag*RHG9B72,-12.00,Alimentação
`;

describe('Import HTTP', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const username = 'import-test-user';
  const password = 'import-test-password';

  let authCookie: string;
  let userId: string;
  let bankId: string;
  let accountId: string;
  let foodId: string;
  let salaryId: string;

  async function cleanup() {
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.importBatch.deleteMany({ where: { userId } });
    await prisma.invoice.deleteMany({ where: { userId } });
    await prisma.category.deleteMany({ where: { userId } });
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.card.deleteMany({ where: { userId } });
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.upsert({
      where: { username },
      update: { passwordHash },
      create: { username, passwordHash },
    });
    userId = user.id;

    const bank = await prisma.bank.upsert({
      where: { userId_name: { userId, name: 'Nubank' } },
      update: {},
      create: { userId, name: 'Nubank' },
    });
    bankId = bank.id;

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password })
      .expect(200);

    authCookie = cookieHeaderFromSetCookie(
      getSetCookie(login.headers as Record<string, unknown>),
    );
  });

  beforeEach(async () => {
    await cleanup();

    const account = await prisma.account.create({
      data: { userId, bankId, label: 'Nubank CC' },
    });
    accountId = account.id;

    const food = await prisma.category.create({
      data: {
        userId,
        name: 'Alimentação',
        kind: 'EXPENSE',
        color: '#2d6a4f',
        icon: 'utensils',
      },
    });
    foodId = food.id;

    const salary = await prisma.category.create({
      data: {
        userId,
        name: 'Salário',
        kind: 'INCOME',
        color: '#2d6a4f',
        icon: 'wallet',
      },
    });
    salaryId = salary.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.bank.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { username } });
    await app.close();
  });

  it('GET /api/imports/options lists parsers and active accounts', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/imports/options')
      .set('Cookie', authCookie)
      .expect(200);

    expect(response.body.parsers).toEqual([
      { id: 'standard', label: 'Padrão' },
    ]);
    expect(response.body.accounts).toEqual([
      expect.objectContaining({ id: accountId, label: 'Nubank CC' }),
    ]);
    expect(response.body.modes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'transactions', enabled: true }),
        expect.objectContaining({ id: 'invoice', enabled: true }),
      ]),
    );
    expect(response.body.cards).toEqual([]);
    expect(response.body.invoicesByCard).toEqual({});
  });

  it('POST /api/imports/preview does not persist and reports unknown categories', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/imports/preview')
      .set('Cookie', authCookie)
      .field('importMode', 'transactions')
      .field('accountId', accountId)
      .field('parserId', 'standard')
      .attach('file', Buffer.from(CSV), 'extrato.csv')
      .expect(200);

    expect(response.body.unknownCategories).toEqual(['Lazer']);
    expect(response.body.summary.duplicateWarningCount).toBe(0);
    expect(response.body.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'Alimentação',
          categoryId: foodId,
          type: 'EXPENSE',
          amount: '-120.50',
          duplicateWarning: null,
        }),
        expect.objectContaining({
          category: 'Salário',
          categoryId: salaryId,
          type: 'INCOME',
          duplicateWarning: null,
        }),
        expect.objectContaining({
          category: 'Lazer',
          categoryId: null,
          duplicateWarning: null,
        }),
      ]),
    );

    expect(await prisma.transaction.count({ where: { userId } })).toBe(0);
    expect(await prisma.importBatch.count({ where: { userId } })).toBe(0);
  });

  it('POST /api/imports/confirm rejects unresolved categories', async () => {
    await request(app.getHttpServer())
      .post('/api/imports/confirm')
      .set('Cookie', authCookie)
      .field('importMode', 'transactions')
      .field('accountId', accountId)
      .field('parserId', 'standard')
      .field('categoryMappings', '{}')
      .field('selectedLines', JSON.stringify(CSV_LINES))
      .attach('file', Buffer.from(CSV), 'extrato.csv')
      .expect(400);
  });

  it('POST /api/imports/confirm rejects missing selectedLines', async () => {
    await request(app.getHttpServer())
      .post('/api/imports/confirm')
      .set('Cookie', authCookie)
      .field('importMode', 'transactions')
      .field('accountId', accountId)
      .field('parserId', 'standard')
      .field(
        'categoryMappings',
        JSON.stringify({ Lazer: { create: { name: 'Lazer' } } }),
      )
      .attach('file', Buffer.from(CSV), 'extrato.csv')
      .expect(400);
  });

  it('POST /api/imports/confirm creates transactions and skips duplicates', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/imports/confirm')
      .set('Cookie', authCookie)
      .field('importMode', 'transactions')
      .field('accountId', accountId)
      .field('parserId', 'standard')
      .field(
        'categoryMappings',
        JSON.stringify({ Lazer: { create: { name: 'Lazer' } } }),
      )
      .field('selectedLines', JSON.stringify(CSV_LINES))
      .attach('file', Buffer.from(CSV), 'extrato.csv')
      .expect(200);

    expect(first.body).toMatchObject({
      id: expect.any(String),
      created: 3,
      skipped: 0,
      deselected: 0,
      errors: [],
    });
    expect(first.body.importBatchId).toBe(first.body.id);

    const rows = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { competenceDate: 'asc' },
    });
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.importBatchId === first.body.id)).toBe(
      true,
    );
    expect(rows.map((row) => row.accountId)).toEqual([
      accountId,
      accountId,
      accountId,
    ]);
    expect(String(rows.find((row) => row.description === 'Supermercado Extra')?.amount)).toBe(
      '-120.5',
    );
    expect(
      rows.find((row) => row.description === 'Supermercado Extra')?.cashDate,
    ).toEqual(
      rows.find((row) => row.description === 'Supermercado Extra')?.competenceDate,
    );

    const second = await request(app.getHttpServer())
      .post('/api/imports/confirm')
      .set('Cookie', authCookie)
      .field('importMode', 'transactions')
      .field('accountId', accountId)
      .field('parserId', 'standard')
      .field(
        'categoryMappings',
        JSON.stringify({ Lazer: { create: { name: 'Lazer' } } }),
      )
      .field('selectedLines', JSON.stringify(CSV_LINES))
      .attach('file', Buffer.from(CSV), 'extrato.csv')
      .expect(200);

    expect(second.body).toMatchObject({ created: 0, skipped: 3, deselected: 0 });
    expect(await prisma.transaction.count({ where: { userId } })).toBe(3);

    const history = await request(app.getHttpServer())
      .get('/api/imports')
      .set('Cookie', authCookie)
      .expect(200);

    expect(history.body).toHaveLength(2);
    expect(history.body[0]).toMatchObject({
      createdCount: 0,
      skippedCount: 3,
      fileName: 'extrato.csv',
      accountLabel: 'Nubank CC',
      bankName: 'Nubank',
      importMode: 'transactions',
    });
  });

  it('POST /api/imports/preview marks within_file and existing duplicate warnings', async () => {
    const previewFirst = await request(app.getHttpServer())
      .post('/api/imports/preview')
      .set('Cookie', authCookie)
      .field('importMode', 'transactions')
      .field('accountId', accountId)
      .field('parserId', 'standard')
      .attach('file', Buffer.from(DUPLICATE_CSV), 'dup.csv')
      .expect(200);

    expect(previewFirst.body.summary.duplicateWarningCount).toBe(2);
    const withinRows = previewFirst.body.rows.filter(
      (row: { duplicateWarning?: string | null }) =>
        row.duplicateWarning === 'within_file',
    );
    expect(withinRows).toHaveLength(2);
    expect(withinRows.map((row: { amount: string }) => row.amount)).toEqual([
      '-12.00',
      '-12.00',
    ]);

    await request(app.getHttpServer())
      .post('/api/imports/confirm')
      .set('Cookie', authCookie)
      .field('importMode', 'transactions')
      .field('accountId', accountId)
      .field('parserId', 'standard')
      .field('categoryMappings', '{}')
      .field('selectedLines', JSON.stringify([2, 3, 4]))
      .attach('file', Buffer.from(DUPLICATE_CSV), 'dup.csv')
      .expect(200);

    const previewSecond = await request(app.getHttpServer())
      .post('/api/imports/preview')
      .set('Cookie', authCookie)
      .field('importMode', 'transactions')
      .field('accountId', accountId)
      .field('parserId', 'standard')
      .attach('file', Buffer.from(DUPLICATE_CSV), 'dup.csv')
      .expect(200);

    expect(previewSecond.body.summary.duplicateWarningCount).toBe(3);
    expect(
      previewSecond.body.rows.filter(
        (row: { duplicateWarning?: string | null }) =>
          row.duplicateWarning === 'existing',
      ),
    ).toHaveLength(3);
  });

  it('POST /api/imports/confirm persists identical rows and honors selectedLines', async () => {
    const both = await request(app.getHttpServer())
      .post('/api/imports/confirm')
      .set('Cookie', authCookie)
      .field('importMode', 'transactions')
      .field('accountId', accountId)
      .field('parserId', 'standard')
      .field('categoryMappings', '{}')
      .field('selectedLines', JSON.stringify([2, 4]))
      .attach('file', Buffer.from(DUPLICATE_CSV), 'dup.csv')
      .expect(200);

    expect(both.body).toMatchObject({
      created: 2,
      skipped: 0,
      deselected: 1,
    });
    expect(await prisma.transaction.count({ where: { userId } })).toBe(2);

    const reimport = await request(app.getHttpServer())
      .post('/api/imports/confirm')
      .set('Cookie', authCookie)
      .field('importMode', 'transactions')
      .field('accountId', accountId)
      .field('parserId', 'standard')
      .field('categoryMappings', '{}')
      .field('selectedLines', JSON.stringify([2, 4]))
      .attach('file', Buffer.from(DUPLICATE_CSV), 'dup.csv')
      .expect(200);

    expect(reimport.body).toMatchObject({
      created: 0,
      skipped: 2,
      deselected: 1,
    });
    expect(await prisma.transaction.count({ where: { userId } })).toBe(2);
  });

  it('POST /api/imports/preview rejects missing account', async () => {
    await request(app.getHttpServer())
      .post('/api/imports/preview')
      .set('Cookie', authCookie)
      .field('importMode', 'transactions')
      .field('parserId', 'standard')
      .attach('file', Buffer.from(CSV), 'extrato.csv')
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/imports/options')
      .expect(401);
  });

  it('POST /api/imports/confirm invoice mode persists card txs with null cashDate', async () => {
    const card = await prisma.card.create({
      data: { userId, bankId, label: 'Nubank Roxinho' },
    });
    const invoice = await prisma.invoice.create({
      data: {
        userId,
        cardId: card.id,
        referenceMonth: new Date('2026-08-01T00:00:00.000Z'),
        dueDate: new Date('2026-09-10T00:00:00.000Z'),
      },
    });

    const invoiceCsv = `date,title,amount
2026-08-31,Pao de Acucar,"-19,90"
2026-08-30,Estorno Apple,"9,90"
`;

    const preview = await request(app.getHttpServer())
      .post('/api/imports/preview')
      .set('Cookie', authCookie)
      .field('importMode', 'invoice')
      .field('cardId', card.id)
      .field('invoiceId', invoice.id)
      .field('parserId', 'standard')
      .attach('file', Buffer.from(invoiceCsv), 'fatura.csv')
      .expect(200);

    expect(preview.body.importMode).toBe('invoice');
    expect(preview.body.unknownCategories).toEqual(['(sem categoria)']);
    expect(preview.body.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: 'Pao de Acucar',
          amount: '-19.90',
          type: 'EXPENSE',
        }),
        expect.objectContaining({
          description: 'Estorno Apple',
          amount: '9.90',
          type: 'EXPENSE',
        }),
      ]),
    );

    const confirm = await request(app.getHttpServer())
      .post('/api/imports/confirm')
      .set('Cookie', authCookie)
      .field('importMode', 'invoice')
      .field('cardId', card.id)
      .field('invoiceId', invoice.id)
      .field('parserId', 'standard')
      .field(
        'categoryMappings',
        JSON.stringify({ '(sem categoria)': foodId }),
      )
      .field('selectedLines', JSON.stringify([2, 3]))
      .attach('file', Buffer.from(invoiceCsv), 'fatura.csv')
      .expect(200);

    expect(confirm.body).toMatchObject({ created: 2, skipped: 0 });

    const history = await request(app.getHttpServer())
      .get('/api/imports')
      .set('Cookie', authCookie)
      .expect(200);

    expect(history.body[0]).toMatchObject({
      importMode: 'invoice',
      fileName: 'fatura.csv',
      cardLabel: 'Nubank Roxinho',
      bankName: 'Nubank',
    });

    const rows = await prisma.transaction.findMany({
      where: { userId, invoiceId: invoice.id },
      orderBy: { competenceDate: 'asc' },
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.cardId === card.id)).toBe(true);
    expect(rows.every((row) => row.accountId === null)).toBe(true);
    expect(rows.every((row) => row.cashDate === null)).toBe(true);
    expect(rows.map((row) => String(row.amount))).toEqual(['9.9', '-19.9']);

    const invoices = await request(app.getHttpServer())
      .get(`/api/cards/${card.id}/invoices`)
      .set('Cookie', authCookie)
      .expect(200);

    expect(invoices.body[0]).toMatchObject({
      id: invoice.id,
      balance: -10,
      status: 'open',
    });
  });

  it('POST /api/imports/confirm maps a parent CSV name to an existing leaf', async () => {
    const child = await prisma.category.create({
      data: {
        userId,
        parentId: foodId,
        name: 'Supermercado',
        kind: 'EXPENSE',
        color: '#2d6a4f',
        icon: 'utensils',
      },
    });

    const csv = `data,descricao,valor,categoria
2026-02-01,Compra,-20.00,Alimentação
`;

    const preview = await request(app.getHttpServer())
      .post('/api/imports/preview')
      .set('Cookie', authCookie)
      .field('importMode', 'transactions')
      .field('accountId', accountId)
      .field('parserId', 'standard')
      .attach('file', Buffer.from(csv), 'extrato.csv')
      .expect(200);

    expect(preview.body.unknownCategories).toContain('Alimentação');

    const createParent = await request(app.getHttpServer())
      .post('/api/imports/confirm')
      .set('Cookie', authCookie)
      .field('importMode', 'transactions')
      .field('accountId', accountId)
      .field('parserId', 'standard')
      .field(
        'categoryMappings',
        JSON.stringify({ Alimentação: { create: { name: 'Alimentação' } } }),
      )
      .field('selectedLines', JSON.stringify([2]))
      .attach('file', Buffer.from(csv), 'extrato.csv')
      .expect(400);

    expect(createParent.body.message).toMatch(/folha existente/i);

    const mapped = await request(app.getHttpServer())
      .post('/api/imports/confirm')
      .set('Cookie', authCookie)
      .field('importMode', 'transactions')
      .field('accountId', accountId)
      .field('parserId', 'standard')
      .field(
        'categoryMappings',
        JSON.stringify({ Alimentação: child.id }),
      )
      .field('selectedLines', JSON.stringify([2]))
      .attach('file', Buffer.from(csv), 'extrato.csv')
      .expect(200);

    expect(mapped.body.created).toBe(1);
    const row = await prisma.transaction.findFirst({
      where: { userId, description: 'Compra' },
    });
    expect(row?.categoryId).toBe(child.id);
  });

  it('POST /api/imports/confirm creates category under optional parentId', async () => {
    const csv = `data,descricao,valor,categoria
2026-03-01,Cinema,-40.00,Lazer
`;

    const confirm = await request(app.getHttpServer())
      .post('/api/imports/confirm')
      .set('Cookie', authCookie)
      .field('importMode', 'transactions')
      .field('accountId', accountId)
      .field('parserId', 'standard')
      .field(
        'categoryMappings',
        JSON.stringify({
          Lazer: { create: { name: 'Lazer', parentId: foodId } },
        }),
      )
      .field('selectedLines', JSON.stringify([2]))
      .attach('file', Buffer.from(csv), 'extrato.csv')
      .expect(200);

    expect(confirm.body.created).toBe(1);

    const created = await prisma.category.findFirst({
      where: { userId, name: 'Lazer' },
    });
    expect(created).toMatchObject({
      parentId: foodId,
      kind: 'EXPENSE',
    });

    const row = await prisma.transaction.findFirst({
      where: { userId, description: 'Cinema' },
    });
    expect(row?.categoryId).toBe(created?.id);
  });

  it('DELETE /api/imports/:id hard-deletes transactions and batch', async () => {
    const confirmed = await request(app.getHttpServer())
      .post('/api/imports/confirm')
      .set('Cookie', authCookie)
      .field('importMode', 'transactions')
      .field('accountId', accountId)
      .field('parserId', 'standard')
      .field(
        'categoryMappings',
        JSON.stringify({ Lazer: { create: { name: 'Lazer' } } }),
      )
      .field('selectedLines', JSON.stringify(CSV_LINES))
      .attach('file', Buffer.from(CSV), 'extrato.csv')
      .expect(200);

    const deleted = await request(app.getHttpServer())
      .delete(`/api/imports/${confirmed.body.id}`)
      .set('Cookie', authCookie)
      .expect(200);

    expect(deleted.body).toEqual({
      id: confirmed.body.id,
      deletedTransactions: 3,
    });
    expect(await prisma.transaction.count({ where: { userId } })).toBe(0);
    expect(await prisma.importBatch.count({ where: { userId } })).toBe(0);
  });

  it('DELETE /api/imports/:id returns 404 for unknown batch', async () => {
    await request(app.getHttpServer())
      .delete('/api/imports/does-not-exist')
      .set('Cookie', authCookie)
      .expect(404);
  });

  it('DELETE /api/imports/:id rejects batches that contain transfers', async () => {
    const transferCsv = `data,descricao,valor,categoria,tipo
2026-03-01,PIX para poupança,-500.00,Alimentação,transferência
`;
    const confirmed = await request(app.getHttpServer())
      .post('/api/imports/confirm')
      .set('Cookie', authCookie)
      .field('importMode', 'transactions')
      .field('accountId', accountId)
      .field('parserId', 'standard')
      .field('categoryMappings', '{}')
      .field('selectedLines', JSON.stringify([2]))
      .attach('file', Buffer.from(transferCsv), 'transfer.csv')
      .expect(200);

    const response = await request(app.getHttpServer())
      .delete(`/api/imports/${confirmed.body.id}`)
      .set('Cookie', authCookie)
      .expect(409);

    expect(response.body.message).toMatch(/transferências/i);
    expect(await prisma.transaction.count({ where: { userId } })).toBe(1);
    expect(await prisma.importBatch.count({ where: { userId } })).toBe(1);
  });

  it('DELETE /api/imports/:id rejects invoice-mode batch when invoice is paid', async () => {
    const card = await prisma.card.create({
      data: { userId, bankId, label: 'Nubank Delete' },
    });
    const invoice = await prisma.invoice.create({
      data: {
        userId,
        cardId: card.id,
        referenceMonth: new Date('2026-07-01T00:00:00.000Z'),
        dueDate: new Date('2026-08-10T00:00:00.000Z'),
      },
    });

    const refundCsv = `date,title,amount
2026-07-15,Estorno teste,"10,00"
`;
    const confirmed = await request(app.getHttpServer())
      .post('/api/imports/confirm')
      .set('Cookie', authCookie)
      .field('importMode', 'invoice')
      .field('cardId', card.id)
      .field('invoiceId', invoice.id)
      .field('parserId', 'standard')
      .field(
        'categoryMappings',
        JSON.stringify({ '(sem categoria)': foodId }),
      )
      .field('selectedLines', JSON.stringify([2]))
      .attach('file', Buffer.from(refundCsv), 'fatura-paid.csv')
      .expect(200);

    expect(confirmed.body.created).toBe(1);

    const invoiceDetail = await request(app.getHttpServer())
      .get(`/api/invoices/${invoice.id}`)
      .set('Cookie', authCookie)
      .expect(200);
    expect(invoiceDetail.body.status).toBe('paid');

    const response = await request(app.getHttpServer())
      .delete(`/api/imports/${confirmed.body.id}`)
      .set('Cookie', authCookie)
      .expect(409);

    expect(response.body.message).toMatch(/quitada/i);
    expect(await prisma.invoice.count({ where: { id: invoice.id } })).toBe(1);
    expect(await prisma.transaction.count({ where: { userId } })).toBe(1);
  });

  it('DELETE /api/imports/:id allows invoice-mode batch when invoice is open and keeps invoice', async () => {
    const card = await prisma.card.create({
      data: { userId, bankId, label: 'Nubank Open Delete' },
    });
    const invoice = await prisma.invoice.create({
      data: {
        userId,
        cardId: card.id,
        referenceMonth: new Date('2026-06-01T00:00:00.000Z'),
        dueDate: new Date('2026-07-10T00:00:00.000Z'),
      },
    });

    const chargeCsv = `date,title,amount
2026-06-15,Mercado,"-50,00"
`;
    const confirmed = await request(app.getHttpServer())
      .post('/api/imports/confirm')
      .set('Cookie', authCookie)
      .field('importMode', 'invoice')
      .field('cardId', card.id)
      .field('invoiceId', invoice.id)
      .field('parserId', 'standard')
      .field(
        'categoryMappings',
        JSON.stringify({ '(sem categoria)': foodId }),
      )
      .field('selectedLines', JSON.stringify([2]))
      .attach('file', Buffer.from(chargeCsv), 'fatura-open.csv')
      .expect(200);

    const deleted = await request(app.getHttpServer())
      .delete(`/api/imports/${confirmed.body.id}`)
      .set('Cookie', authCookie)
      .expect(200);

    expect(deleted.body.deletedTransactions).toBe(1);
    expect(await prisma.invoice.count({ where: { id: invoice.id } })).toBe(1);
    expect(await prisma.transaction.count({ where: { userId } })).toBe(0);
    expect(await prisma.importBatch.count({ where: { userId } })).toBe(0);

    const invoiceDetail = await request(app.getHttpServer())
      .get(`/api/invoices/${invoice.id}`)
      .set('Cookie', authCookie)
      .expect(200);
    expect(invoiceDetail.body).toMatchObject({
      balance: 0,
      status: 'paid',
      transactions: [],
    });
  });
});
