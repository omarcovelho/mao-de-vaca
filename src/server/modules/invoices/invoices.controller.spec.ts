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

  beforeEach(async () => {
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.importBatch.deleteMany({ where: { userId } });
    await prisma.invoice.deleteMany({ where: { userId } });
    await prisma.category.deleteMany({ where: { userId } });
    await prisma.card.deleteMany({ where: { userId } });

    const card = await prisma.card.create({
      data: { userId, bankId, label: 'Nubank Roxinho' },
    });
    cardId = card.id;

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
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.importBatch.deleteMany({ where: { userId } });
    await prisma.invoice.deleteMany({ where: { userId } });
    await prisma.category.deleteMany({ where: { userId } });
    await prisma.card.deleteMany({ where: { userId } });
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
});
