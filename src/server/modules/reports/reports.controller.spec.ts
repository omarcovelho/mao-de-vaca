import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import { Prisma } from '@prisma/client';
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

describe('Reports HTTP', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const username = 'reports-test-user';
  const password = 'reports-test-password';

  let authCookie: string;
  let userId: string;
  let bankId: string;
  let accountId: string;
  let foodId: string;
  let leisureId: string;
  let salaryId: string;
  let transferCategoryId: string;
  let batchId: string;

  async function cleanup() {
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.importBatch.deleteMany({ where: { userId } });
    await prisma.category.deleteMany({ where: { userId } });
    await prisma.account.deleteMany({ where: { userId } });
  }

  async function seedTransaction(input: {
    description: string;
    amount: string;
    type: 'EXPENSE' | 'INCOME' | 'TRANSFER';
    categoryId: string;
    competenceDate: string;
    cashDate?: string;
    active?: boolean;
    dedupKey: string;
  }) {
    return prisma.transaction.create({
      data: {
        userId,
        description: input.description,
        amount: new Prisma.Decimal(input.amount),
        type: input.type,
        categoryId: input.categoryId,
        accountId,
        competenceDate: new Date(input.competenceDate),
        cashDate: new Date(input.cashDate ?? input.competenceDate),
        importBatchId: batchId,
        dedupKey: input.dedupKey,
        active: input.active ?? true,
      },
    });
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
      data: { userId, bankId, label: 'Conta principal' },
    });
    accountId = account.id;

    const [food, leisure, salary, transferCat] = await Promise.all([
      prisma.category.create({
        data: {
          userId,
          name: 'Alimentação',
          kind: 'EXPENSE',
          color: '#2d6a4f',
          icon: 'utensils',
        },
      }),
      prisma.category.create({
        data: {
          userId,
          name: 'Lazer',
          kind: 'EXPENSE',
          color: '#40916c',
          icon: 'sparkles',
        },
      }),
      prisma.category.create({
        data: {
          userId,
          name: 'Salário',
          kind: 'INCOME',
          color: '#1b4332',
          icon: 'wallet',
        },
      }),
      prisma.category.create({
        data: {
          userId,
          name: 'Transferência',
          kind: 'NON_EXPENSE',
          color: '#6c757d',
          icon: 'arrow-left-right',
        },
      }),
    ]);
    foodId = food.id;
    leisureId = leisure.id;
    salaryId = salary.id;
    transferCategoryId = transferCat.id;

    const batch = await prisma.importBatch.create({
      data: {
        userId,
        importMode: 'TRANSACTIONS',
        accountId,
        parserId: 'standard-csv',
        fileName: 'extrato.csv',
        createdCount: 0,
        skippedCount: 0,
        errorCount: 0,
      },
    });
    batchId = batch.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.bank.deleteMany({ where: { userId, name: 'Nubank' } });
    await app.close();
  });

  it('GET /api/reports/summary excludes transfers and inactive; balance = income - expense', async () => {
    await Promise.all([
      seedTransaction({
        description: 'Mercado',
        amount: '-100.00',
        type: 'EXPENSE',
        categoryId: foodId,
        competenceDate: '2026-03-10',
        dedupKey: 'sum-food',
      }),
      seedTransaction({
        description: 'Cinema',
        amount: '-40.00',
        type: 'EXPENSE',
        categoryId: leisureId,
        competenceDate: '2026-03-12',
        dedupKey: 'sum-leisure',
      }),
      seedTransaction({
        description: 'Salário',
        amount: '2000.00',
        type: 'INCOME',
        categoryId: salaryId,
        competenceDate: '2026-03-05',
        dedupKey: 'sum-salary',
      }),
      seedTransaction({
        description: 'PIX saída',
        amount: '-500.00',
        type: 'TRANSFER',
        categoryId: transferCategoryId,
        competenceDate: '2026-03-08',
        dedupKey: 'sum-transfer',
      }),
      seedTransaction({
        description: 'Desativado',
        amount: '-999.00',
        type: 'EXPENSE',
        categoryId: foodId,
        competenceDate: '2026-03-15',
        active: false,
        dedupKey: 'sum-inactive',
      }),
    ]);

    const response = await request(app.getHttpServer())
      .get('/api/reports/summary')
      .query({ regime: 'competence', from: '2026-03-01', to: '2026-03-31' })
      .set('Cookie', authCookie)
      .expect(200);

    expect(response.body).toEqual({
      regime: 'competence',
      from: '2026-03-01',
      to: '2026-03-31',
      expenseTotal: 140,
      incomeTotal: 2000,
      balance: 1860,
    });
  });

  it('GET /api/reports/summary filters by cashDate when regime=cash', async () => {
    await Promise.all([
      seedTransaction({
        description: 'Compra competência mar',
        amount: '-50.00',
        type: 'EXPENSE',
        categoryId: foodId,
        competenceDate: '2026-03-20',
        cashDate: '2026-04-05',
        dedupKey: 'cash-regime-a',
      }),
      seedTransaction({
        description: 'Compra caixa mar',
        amount: '-30.00',
        type: 'EXPENSE',
        categoryId: leisureId,
        competenceDate: '2026-02-10',
        cashDate: '2026-03-15',
        dedupKey: 'cash-regime-b',
      }),
    ]);

    const response = await request(app.getHttpServer())
      .get('/api/reports/summary')
      .query({ regime: 'cash', from: '2026-03-01', to: '2026-03-31' })
      .set('Cookie', authCookie)
      .expect(200);

    expect(response.body.expenseTotal).toBe(30);
    expect(response.body.incomeTotal).toBe(0);
    expect(response.body.balance).toBe(-30);
  });

  it('GET /api/reports/summary returns zeros for empty period', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/reports/summary')
      .query({ regime: 'competence', from: '2026-01-01', to: '2026-01-31' })
      .set('Cookie', authCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      expenseTotal: 0,
      incomeTotal: 0,
      balance: 0,
    });
  });

  it('GET /api/reports/by-category returns rolled-up parent tree with expandable children', async () => {
    const housing = await prisma.category.create({
      data: {
        userId,
        name: 'Moradia',
        kind: 'EXPENSE',
        color: '#1b4332',
        icon: 'home',
      },
    });
    const rent = await prisma.category.create({
      data: {
        userId,
        parentId: housing.id,
        name: 'Aluguel',
        kind: 'EXPENSE',
        color: '#2d6a4f',
        icon: 'key',
      },
    });
    const utilities = await prisma.category.create({
      data: {
        userId,
        parentId: housing.id,
        name: 'Contas',
        kind: 'EXPENSE',
        color: '#40916c',
        icon: 'zap',
      },
    });

    await Promise.all([
      seedTransaction({
        description: 'Aluguel',
        amount: '-1000.00',
        type: 'EXPENSE',
        categoryId: rent.id,
        competenceDate: '2026-03-05',
        dedupKey: 'tree-rent',
      }),
      seedTransaction({
        description: 'Luz',
        amount: '-200.00',
        type: 'EXPENSE',
        categoryId: utilities.id,
        competenceDate: '2026-03-08',
        dedupKey: 'tree-util',
      }),
      seedTransaction({
        description: 'Mercado',
        amount: '-100.00',
        type: 'EXPENSE',
        categoryId: foodId,
        competenceDate: '2026-03-10',
        dedupKey: 'tree-food',
      }),
      seedTransaction({
        description: 'PIX',
        amount: '-200.00',
        type: 'TRANSFER',
        categoryId: transferCategoryId,
        competenceDate: '2026-03-08',
        dedupKey: 'tree-transfer',
      }),
    ]);

    const response = await request(app.getHttpServer())
      .get('/api/reports/by-category')
      .query({ regime: 'competence', from: '2026-03-01', to: '2026-03-31' })
      .set('Cookie', authCookie)
      .expect(200);

    expect(response.body.items).toHaveLength(2);
    expect(response.body.items[0]).toMatchObject({
      categoryId: housing.id,
      name: 'Moradia',
      total: 1200,
      percent: expect.closeTo(92.31, 1),
    });
    expect(response.body.items[0].children).toEqual([
      expect.objectContaining({
        categoryId: rent.id,
        name: 'Aluguel',
        total: 1000,
        children: [],
      }),
      expect.objectContaining({
        categoryId: utilities.id,
        name: 'Contas',
        total: 200,
        children: [],
      }),
    ]);
    expect(response.body.items[1]).toMatchObject({
      categoryId: foodId,
      name: 'Alimentação',
      total: 100,
      children: [],
    });
  });

  it('GET /api/reports/by-category returns flat roots when categories have no parents', async () => {
    await Promise.all([
      seedTransaction({
        description: 'Mercado',
        amount: '-100.00',
        type: 'EXPENSE',
        categoryId: foodId,
        competenceDate: '2026-03-10',
        dedupKey: 'cat-food',
      }),
      seedTransaction({
        description: 'Cinema',
        amount: '-50.00',
        type: 'EXPENSE',
        categoryId: leisureId,
        competenceDate: '2026-03-12',
        dedupKey: 'cat-leisure',
      }),
      seedTransaction({
        description: 'Salário',
        amount: '2000.00',
        type: 'INCOME',
        categoryId: salaryId,
        competenceDate: '2026-03-05',
        dedupKey: 'cat-salary',
      }),
      seedTransaction({
        description: 'PIX',
        amount: '-200.00',
        type: 'TRANSFER',
        categoryId: transferCategoryId,
        competenceDate: '2026-03-08',
        dedupKey: 'cat-transfer',
      }),
    ]);

    const response = await request(app.getHttpServer())
      .get('/api/reports/by-category')
      .query({ regime: 'competence', from: '2026-03-01', to: '2026-03-31' })
      .set('Cookie', authCookie)
      .expect(200);

    expect(response.body.regime).toBe('competence');
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items[0]).toMatchObject({
      categoryId: foodId,
      name: 'Alimentação',
      color: '#2d6a4f',
      icon: 'utensils',
      total: 100,
      percent: expect.closeTo(66.67, 1),
      children: [],
    });
    expect(response.body.items[1]).toMatchObject({
      categoryId: leisureId,
      name: 'Lazer',
      total: 50,
      percent: expect.closeTo(33.33, 1),
      children: [],
    });
  });

  it('GET /api/reports/monthly-evolution returns months window oldest to newest', async () => {
    await Promise.all([
      seedTransaction({
        description: 'Jan gasto',
        amount: '-10.00',
        type: 'EXPENSE',
        categoryId: foodId,
        competenceDate: '2026-01-15',
        dedupKey: 'evo-jan',
      }),
      seedTransaction({
        description: 'Mar gasto',
        amount: '-25.00',
        type: 'EXPENSE',
        categoryId: foodId,
        competenceDate: '2026-03-10',
        dedupKey: 'evo-mar-exp',
      }),
      seedTransaction({
        description: 'Mar receita',
        amount: '100.00',
        type: 'INCOME',
        categoryId: salaryId,
        competenceDate: '2026-03-05',
        dedupKey: 'evo-mar-inc',
      }),
      seedTransaction({
        description: 'Transfer mar',
        amount: '-999.00',
        type: 'TRANSFER',
        categoryId: transferCategoryId,
        competenceDate: '2026-03-20',
        dedupKey: 'evo-transfer',
      }),
    ]);

    const response = await request(app.getHttpServer())
      .get('/api/reports/monthly-evolution')
      .query({ regime: 'competence', months: '3', endMonth: '2026-03' })
      .set('Cookie', authCookie)
      .expect(200);

    expect(response.body.regime).toBe('competence');
    expect(response.body.months).toBe(3);
    expect(response.body.endMonth).toBe('2026-03');
    expect(response.body.items).toEqual([
      { month: '2026-01', expenseTotal: 10, incomeTotal: 0 },
      { month: '2026-02', expenseTotal: 0, incomeTotal: 0 },
      { month: '2026-03', expenseTotal: 25, incomeTotal: 100 },
    ]);
  });

  it('rejects summary without from/to', async () => {
    await request(app.getHttpServer())
      .get('/api/reports/summary')
      .query({ regime: 'competence' })
      .set('Cookie', authCookie)
      .expect(400);
  });

  it('requires auth', async () => {
    await request(app.getHttpServer())
      .get('/api/reports/summary')
      .query({ regime: 'competence', from: '2026-03-01', to: '2026-03-31' })
      .expect(401);
  });
});
