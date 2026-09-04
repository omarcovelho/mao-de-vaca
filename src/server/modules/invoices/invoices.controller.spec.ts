import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import { ImportMode, TransactionType } from '@prisma/client';
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

describe('Invoices HTTP', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const username = 'invoices-test-user';
  const password = 'invoices-test-password';

  let authCookie: string;
  let userId: string;
  let bankId: string;
  let cardId: string;
  let categoryId: string;

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

  let accountId: string;

  beforeEach(async () => {
    await prisma.invoicePaymentLink.deleteMany({ where: { userId } });
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.importBatch.deleteMany({ where: { userId } });
    await prisma.invoice.deleteMany({ where: { userId } });
    await prisma.category.deleteMany({ where: { userId } });
    await prisma.card.deleteMany({ where: { userId } });
    await prisma.account.deleteMany({ where: { userId } });

    const card = await prisma.card.create({
      data: { userId, bankId, label: 'Nubank Roxinho' },
    });
    cardId = card.id;

    const account = await prisma.account.create({
      data: { userId, bankId, label: 'Conta Nubank' },
    });
    accountId = account.id;

    const category = await prisma.category.create({
      data: {
        userId,
        name: 'Alimentação',
        kind: 'EXPENSE',
        color: '#2d6a4f',
        icon: 'utensils',
      },
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    await prisma.invoicePaymentLink.deleteMany({ where: { userId } });
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.importBatch.deleteMany({ where: { userId } });
    await prisma.invoice.deleteMany({ where: { userId } });
    await prisma.category.deleteMany({ where: { userId } });
    await prisma.card.deleteMany({ where: { userId } });
    await prisma.account.deleteMany({ where: { userId } });
    await app.close();
  });

  it('POST /api/cards/:cardId/invoices creates an invoice', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/cards/${cardId}/invoices`)
      .set('Cookie', authCookie)
      .send({ referenceMonth: '2026-08', dueDate: '2026-09-10' })
      .expect(201);

    expect(res.body).toMatchObject({
      cardId,
      referenceMonth: '2026-08-01',
      dueDate: '2026-09-10',
      balance: 0,
      status: 'paid',
    });
    expect(res.body.id).toBeTruthy();
  });

  it('GET /api/cards/:cardId/invoices lists with balance = sum of amounts', async () => {
    const invoice = await prisma.invoice.create({
      data: {
        userId,
        cardId,
        referenceMonth: new Date('2026-08-01T00:00:00.000Z'),
        dueDate: new Date('2026-09-10T00:00:00.000Z'),
      },
    });

    const batch = await prisma.importBatch.create({
      data: {
        userId,
        importMode: ImportMode.INVOICE,
        cardId,
        invoiceId: invoice.id,
        parserId: 'standard',
        fileName: 'fatura.csv',
        createdCount: 3,
        skippedCount: 0,
        errorCount: 0,
      },
    });

    await prisma.transaction.createMany({
      data: [
        {
          userId,
          competenceDate: new Date('2026-08-10T00:00:00.000Z'),
          cashDate: null,
          description: 'Mercado',
          amount: -100,
          type: TransactionType.EXPENSE,
          categoryId,
          cardId,
          invoiceId: invoice.id,
          importBatchId: batch.id,
          dedupKey: 'inv-1',
        },
        {
          userId,
          competenceDate: new Date('2026-08-11T00:00:00.000Z'),
          cashDate: null,
          description: 'Farmácia',
          amount: -50,
          type: TransactionType.EXPENSE,
          categoryId,
          cardId,
          invoiceId: invoice.id,
          importBatchId: batch.id,
          dedupKey: 'inv-2',
        },
        {
          userId,
          competenceDate: new Date('2026-08-12T00:00:00.000Z'),
          cashDate: null,
          description: 'Estorno Apple',
          amount: 20,
          type: TransactionType.EXPENSE,
          categoryId,
          cardId,
          invoiceId: invoice.id,
          importBatchId: batch.id,
          dedupKey: 'inv-3',
        },
      ],
    });

    const res = await request(app.getHttpServer())
      .get(`/api/cards/${cardId}/invoices`)
      .set('Cookie', authCookie)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      id: invoice.id,
      balance: -130,
      status: 'open',
      referenceMonth: '2026-08-01',
      dueDate: '2026-09-10',
    });
  });

  it('POST rejects duplicate reference month for the same card', async () => {
    await request(app.getHttpServer())
      .post(`/api/cards/${cardId}/invoices`)
      .set('Cookie', authCookie)
      .send({ referenceMonth: '2026-08', dueDate: '2026-09-10' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/cards/${cardId}/invoices`)
      .set('Cookie', authCookie)
      .send({ referenceMonth: '2026-08-01', dueDate: '2026-09-15' })
      .expect(409);
  });

  it('GET /api/invoices/:id returns detail with transactions', async () => {
    const invoice = await prisma.invoice.create({
      data: {
        userId,
        cardId,
        referenceMonth: new Date('2026-08-01T00:00:00.000Z'),
        dueDate: new Date('2026-09-10T00:00:00.000Z'),
      },
    });

    const batch = await prisma.importBatch.create({
      data: {
        userId,
        importMode: ImportMode.INVOICE,
        cardId,
        invoiceId: invoice.id,
        parserId: 'standard',
        fileName: 'fatura.csv',
        createdCount: 2,
        skippedCount: 0,
        errorCount: 0,
      },
    });

    await prisma.transaction.createMany({
      data: [
        {
          userId,
          competenceDate: new Date('2026-08-10T00:00:00.000Z'),
          cashDate: null,
          description: 'Mercado',
          amount: -100,
          type: TransactionType.EXPENSE,
          categoryId,
          cardId,
          invoiceId: invoice.id,
          importBatchId: batch.id,
          dedupKey: 'detail-1',
        },
        {
          userId,
          competenceDate: new Date('2026-08-12T00:00:00.000Z'),
          cashDate: null,
          description: 'Estorno',
          amount: 20,
          type: TransactionType.EXPENSE,
          categoryId,
          cardId,
          invoiceId: invoice.id,
          importBatchId: batch.id,
          dedupKey: 'detail-2',
        },
      ],
    });

    const res = await request(app.getHttpServer())
      .get(`/api/invoices/${invoice.id}`)
      .set('Cookie', authCookie)
      .expect(200);

    expect(res.body).toMatchObject({
      id: invoice.id,
      cardId,
      balance: -80,
      status: 'open',
      card: { id: cardId, label: 'Nubank Roxinho' },
    });
    expect(res.body.transactions).toHaveLength(2);
    expect(res.body.transactions[0].description).toBe('Estorno');
    expect(res.body.transactions[1]).toMatchObject({
      description: 'Mercado',
      amount: -100,
      category: { name: 'Alimentação' },
    });
  });

  it('GET /api/invoices/:id returns 404 for unknown invoice', async () => {
    await request(app.getHttpServer())
      .get('/api/invoices/does-not-exist')
      .set('Cookie', authCookie)
      .expect(404);
  });

  async function seedInvoiceWithPurchases(netAmounts: number[]) {
    const invoice = await prisma.invoice.create({
      data: {
        userId,
        cardId,
        referenceMonth: new Date('2026-08-01T00:00:00.000Z'),
        dueDate: new Date('2026-09-10T00:00:00.000Z'),
      },
    });

    const batch = await prisma.importBatch.create({
      data: {
        userId,
        importMode: ImportMode.INVOICE,
        cardId,
        invoiceId: invoice.id,
        parserId: 'standard',
        fileName: 'fatura.csv',
        createdCount: netAmounts.length,
        skippedCount: 0,
        errorCount: 0,
      },
    });

    const purchaseIds: string[] = [];
    for (let i = 0; i < netAmounts.length; i += 1) {
      const tx = await prisma.transaction.create({
        data: {
          userId,
          competenceDate: new Date(`2026-08-${String(10 + i).padStart(2, '0')}T00:00:00.000Z`),
          cashDate: null,
          description: `Compra ${i + 1}`,
          amount: netAmounts[i],
          type: TransactionType.EXPENSE,
          categoryId,
          cardId,
          invoiceId: invoice.id,
          importBatchId: batch.id,
          dedupKey: `purchase-${i}-${Date.now()}`,
        },
      });
      purchaseIds.push(tx.id);
    }

    return { invoice, purchaseIds, batch };
  }

  async function seedAccountDebit(input: {
    amount: number;
    date: string;
    dedupKey: string;
    description?: string;
  }) {
    const batch = await prisma.importBatch.create({
      data: {
        userId,
        importMode: ImportMode.TRANSACTIONS,
        accountId,
        parserId: 'standard',
        fileName: 'extrato.csv',
        createdCount: 1,
        skippedCount: 0,
        errorCount: 0,
      },
    });

    return prisma.transaction.create({
      data: {
        userId,
        competenceDate: new Date(`${input.date}T00:00:00.000Z`),
        cashDate: new Date(`${input.date}T00:00:00.000Z`),
        description: input.description ?? 'Pagamento fatura Nubank',
        amount: input.amount,
        type: TransactionType.EXPENSE,
        categoryId,
        accountId,
        importBatchId: batch.id,
        dedupKey: input.dedupKey,
      },
    });
  }

  it('POST /api/invoices/:id/payments links debit as INVOICE_PAYMENT and quits invoice', async () => {
    const { invoice, purchaseIds } = await seedInvoiceWithPurchases([-300, -200]);
    const payment = await seedAccountDebit({
      amount: -500,
      date: '2026-09-10',
      dedupKey: 'pay-full',
    });

    const res = await request(app.getHttpServer())
      .post(`/api/invoices/${invoice.id}/payments`)
      .set('Cookie', authCookie)
      .send({ transactionIds: [payment.id] })
      .expect(200);

    expect(res.body).toMatchObject({
      id: invoice.id,
      balance: 0,
      status: 'paid',
    });
    expect(res.body.payments).toHaveLength(1);
    expect(res.body.payments[0]).toMatchObject({
      id: payment.id,
      amount: -500,
      type: 'INVOICE_PAYMENT',
      account: { id: accountId, label: 'Conta Nubank' },
    });

    const updatedPayment = await prisma.transaction.findUniqueOrThrow({
      where: { id: payment.id },
    });
    expect(updatedPayment.type).toBe(TransactionType.INVOICE_PAYMENT);

    const purchases = await prisma.transaction.findMany({
      where: { id: { in: purchaseIds } },
    });
    for (const purchase of purchases) {
      expect(purchase.cashDate?.toISOString().slice(0, 10)).toBe('2026-09-10');
    }
  });

  it('POST /api/invoices/:id/payments supports partial payment status', async () => {
    const { invoice } = await seedInvoiceWithPurchases([-500]);
    const payment = await seedAccountDebit({
      amount: -200,
      date: '2026-09-05',
      dedupKey: 'pay-partial',
    });

    const res = await request(app.getHttpServer())
      .post(`/api/invoices/${invoice.id}/payments`)
      .set('Cookie', authCookie)
      .send({ transactionIds: [payment.id] })
      .expect(200);

    expect(res.body).toMatchObject({
      balance: -300,
      status: 'partial',
    });
  });

  it('POST /api/invoices/:id/payments uses latest payment date for cashDate', async () => {
    const { invoice, purchaseIds } = await seedInvoiceWithPurchases([-500]);
    const first = await seedAccountDebit({
      amount: -200,
      date: '2026-09-05',
      dedupKey: 'pay-1',
    });
    const second = await seedAccountDebit({
      amount: -300,
      date: '2026-09-20',
      dedupKey: 'pay-2',
    });

    await request(app.getHttpServer())
      .post(`/api/invoices/${invoice.id}/payments`)
      .set('Cookie', authCookie)
      .send({ transactionIds: [first.id] })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/invoices/${invoice.id}/payments`)
      .set('Cookie', authCookie)
      .send({ transactionIds: [second.id] })
      .expect(200);

    const purchases = await prisma.transaction.findMany({
      where: { id: { in: purchaseIds } },
    });
    for (const purchase of purchases) {
      expect(purchase.cashDate?.toISOString().slice(0, 10)).toBe('2026-09-20');
    }

    const list = await request(app.getHttpServer())
      .get(`/api/cards/${cardId}/invoices`)
      .set('Cookie', authCookie)
      .expect(200);

    expect(list.body[0]).toMatchObject({
      id: invoice.id,
      balance: 0,
      status: 'paid',
    });
  });

  it('POST /api/invoices/:id/payments rejects already linked transaction', async () => {
    const { invoice } = await seedInvoiceWithPurchases([-100]);
    const payment = await seedAccountDebit({
      amount: -100,
      date: '2026-09-10',
      dedupKey: 'pay-dup',
    });

    await request(app.getHttpServer())
      .post(`/api/invoices/${invoice.id}/payments`)
      .set('Cookie', authCookie)
      .send({ transactionIds: [payment.id] })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/invoices/${invoice.id}/payments`)
      .set('Cookie', authCookie)
      .send({ transactionIds: [payment.id] })
      .expect(400);
  });

  it('POST /api/invoices/:id/payments rejects card transactions', async () => {
    const { invoice, purchaseIds } = await seedInvoiceWithPurchases([-100]);

    await request(app.getHttpServer())
      .post(`/api/invoices/${invoice.id}/payments`)
      .set('Cookie', authCookie)
      .send({ transactionIds: [purchaseIds[0]] })
      .expect(400);
  });

  it('GET /api/invoices/:id includes empty payments when none linked', async () => {
    const { invoice } = await seedInvoiceWithPurchases([-50]);

    const res = await request(app.getHttpServer())
      .get(`/api/invoices/${invoice.id}`)
      .set('Cookie', authCookie)
      .expect(200);

    expect(res.body.payments).toEqual([]);
    expect(res.body.status).toBe('open');
  });
});
