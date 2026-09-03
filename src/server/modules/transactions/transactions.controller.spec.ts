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

describe('Transactions HTTP', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const username = 'tx-list-test-user';
  const password = 'tx-list-test-password';

  let authCookie: string;
  let userId: string;
  let bankId: string;
  let accountAId: string;
  let accountBId: string;
  let foodId: string;
  let leisureId: string;
  let salaryId: string;
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
    type: 'EXPENSE' | 'INCOME';
    categoryId: string;
    accountId: string;
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
        accountId: input.accountId,
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

    const [accountA, accountB] = await Promise.all([
      prisma.account.create({
        data: { userId, bankId, label: 'Conta A' },
      }),
      prisma.account.create({
        data: { userId, bankId, label: 'Conta B' },
      }),
    ]);
    accountAId = accountA.id;
    accountBId = accountB.id;

    const [food, leisure, salary] = await Promise.all([
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
    ]);
    foodId = food.id;
    leisureId = leisure.id;
    salaryId = salary.id;

    const batch = await prisma.importBatch.create({
      data: {
        userId,
        importMode: 'TRANSACTIONS',
        accountId: accountAId,
        parserId: 'standard',
        fileName: 'fixture.csv',
        createdCount: 0,
        skippedCount: 0,
        errorCount: 0,
      },
    });
    batchId = batch.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.bank.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    await app.close();
  });

  it('GET /api/transactions returns all accounts in the period for competence', async () => {
    await seedTransaction({
      description: 'Mercado A',
      amount: '50.00',
      type: 'EXPENSE',
      categoryId: foodId,
      accountId: accountAId,
      competenceDate: '2026-01-10',
      dedupKey: 'a-1',
    });
    await seedTransaction({
      description: 'Mercado B',
      amount: '30.00',
      type: 'EXPENSE',
      categoryId: foodId,
      accountId: accountBId,
      competenceDate: '2026-01-15',
      dedupKey: 'b-1',
    });
    await seedTransaction({
      description: 'Fora do mês',
      amount: '10.00',
      type: 'EXPENSE',
      categoryId: foodId,
      accountId: accountAId,
      competenceDate: '2026-02-01',
      dedupKey: 'a-2',
    });

    const res = await request(app.getHttpServer())
      .get('/api/transactions')
      .query({
        regime: 'competence',
        from: '2026-01-01',
        to: '2026-01-31',
      })
      .set('Cookie', authCookie)
      .expect(200);

    expect(res.body.regime).toBe('competence');
    expect(res.body.from).toBe('2026-01-01');
    expect(res.body.to).toBe('2026-01-31');
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.map((i: { description: string }) => i.description)).toEqual(
      ['Mercado B', 'Mercado A'],
    );
    expect(res.body.items[0].account.label).toBe('Conta B');
    expect(res.body.items[0].account.bank.name).toBe('Nubank');
    expect(res.body.items[0].category.name).toBe('Alimentação');
    expect(res.body.items[0].displayDate).toBe('2026-01-15');
    expect(res.body.items[0].active).toBe(true);
  });

  it('GET /api/transactions filters by cashDate when regime is cash', async () => {
    await seedTransaction({
      description: 'Só competência jan',
      amount: '20.00',
      type: 'EXPENSE',
      categoryId: foodId,
      accountId: accountAId,
      competenceDate: '2026-01-10',
      cashDate: '2026-02-05',
      dedupKey: 'cash-1',
    });

    const competence = await request(app.getHttpServer())
      .get('/api/transactions')
      .query({
        regime: 'competence',
        from: '2026-01-01',
        to: '2026-01-31',
      })
      .set('Cookie', authCookie)
      .expect(200);

    expect(competence.body.items).toHaveLength(1);
    expect(competence.body.items[0].displayDate).toBe('2026-01-10');

    const cashJan = await request(app.getHttpServer())
      .get('/api/transactions')
      .query({
        regime: 'cash',
        from: '2026-01-01',
        to: '2026-01-31',
      })
      .set('Cookie', authCookie)
      .expect(200);

    expect(cashJan.body.items).toHaveLength(0);

    const cashFeb = await request(app.getHttpServer())
      .get('/api/transactions')
      .query({
        regime: 'cash',
        from: '2026-02-01',
        to: '2026-02-28',
      })
      .set('Cookie', authCookie)
      .expect(200);

    expect(cashFeb.body.items).toHaveLength(1);
    expect(cashFeb.body.items[0].displayDate).toBe('2026-02-05');
  });

  it('GET /api/transactions supports optional categoryId and accountId', async () => {
    await seedTransaction({
      description: 'Food A',
      amount: '10.00',
      type: 'EXPENSE',
      categoryId: foodId,
      accountId: accountAId,
      competenceDate: '2026-01-10',
      dedupKey: 'f-a',
    });
    await seedTransaction({
      description: 'Leisure B',
      amount: '15.00',
      type: 'EXPENSE',
      categoryId: leisureId,
      accountId: accountBId,
      competenceDate: '2026-01-12',
      dedupKey: 'l-b',
    });

    const byCategory = await request(app.getHttpServer())
      .get('/api/transactions')
      .query({
        from: '2026-01-01',
        to: '2026-01-31',
        categoryId: leisureId,
      })
      .set('Cookie', authCookie)
      .expect(200);

    expect(byCategory.body.items).toHaveLength(1);
    expect(byCategory.body.items[0].description).toBe('Leisure B');

    const byAccount = await request(app.getHttpServer())
      .get('/api/transactions')
      .query({
        from: '2026-01-01',
        to: '2026-01-31',
        accountId: accountAId,
      })
      .set('Cookie', authCookie)
      .expect(200);

    expect(byAccount.body.items).toHaveLength(1);
    expect(byAccount.body.items[0].description).toBe('Food A');
  });

  it('GET /api/transactions excludes inactive by default', async () => {
    await seedTransaction({
      description: 'Ativo',
      amount: '10.00',
      type: 'EXPENSE',
      categoryId: foodId,
      accountId: accountAId,
      competenceDate: '2026-01-10',
      dedupKey: 'active-1',
    });
    await seedTransaction({
      description: 'Inativo',
      amount: '10.00',
      type: 'EXPENSE',
      categoryId: foodId,
      accountId: accountAId,
      competenceDate: '2026-01-11',
      active: false,
      dedupKey: 'inactive-1',
    });

    const res = await request(app.getHttpServer())
      .get('/api/transactions')
      .query({ from: '2026-01-01', to: '2026-01-31' })
      .set('Cookie', authCookie)
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].description).toBe('Ativo');

    const withInactive = await request(app.getHttpServer())
      .get('/api/transactions')
      .query({
        from: '2026-01-01',
        to: '2026-01-31',
        includeInactive: 'true',
      })
      .set('Cookie', authCookie)
      .expect(200);

    expect(withInactive.body.items).toHaveLength(2);
  });

  it('PATCH /api/transactions/:id updates categoryId for an active leaf', async () => {
    const tx = await seedTransaction({
      description: 'Mercado',
      amount: '40.00',
      type: 'EXPENSE',
      categoryId: foodId,
      accountId: accountAId,
      competenceDate: '2026-01-10',
      dedupKey: 'patch-cat',
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/transactions/${tx.id}`)
      .set('Cookie', authCookie)
      .send({ categoryId: leisureId })
      .expect(200);

    expect(res.body.category.id).toBe(leisureId);
    expect(res.body.category.name).toBe('Lazer');
  });

  it('PATCH /api/transactions/:id rejects non-leaf category', async () => {
    const parent = await prisma.category.create({
      data: {
        userId,
        name: 'Custos',
        kind: 'EXPENSE',
        color: '#2d6a4f',
        icon: 'home',
      },
    });
    await prisma.category.create({
      data: {
        userId,
        parentId: parent.id,
        name: 'Filha',
        kind: 'EXPENSE',
        color: '#2d6a4f',
        icon: 'home',
      },
    });

    const tx = await seedTransaction({
      description: 'Mercado',
      amount: '40.00',
      type: 'EXPENSE',
      categoryId: foodId,
      accountId: accountAId,
      competenceDate: '2026-01-10',
      dedupKey: 'patch-nonleaf',
    });

    await request(app.getHttpServer())
      .patch(`/api/transactions/${tx.id}`)
      .set('Cookie', authCookie)
      .send({ categoryId: parent.id })
      .expect(400);
  });

  it('PATCH /api/transactions/:id deactivates and hides from default list', async () => {
    const tx = await seedTransaction({
      description: 'Para desativar',
      amount: '40.00',
      type: 'EXPENSE',
      categoryId: foodId,
      accountId: accountAId,
      competenceDate: '2026-01-10',
      dedupKey: 'patch-active',
    });

    const patched = await request(app.getHttpServer())
      .patch(`/api/transactions/${tx.id}`)
      .set('Cookie', authCookie)
      .send({ active: false })
      .expect(200);

    expect(patched.body.active).toBe(false);

    const list = await request(app.getHttpServer())
      .get('/api/transactions')
      .query({ from: '2026-01-01', to: '2026-01-31' })
      .set('Cookie', authCookie)
      .expect(200);

    expect(list.body.items).toHaveLength(0);
  });

  it('GET /api/transactions requires from and to', async () => {
    await request(app.getHttpServer())
      .get('/api/transactions')
      .set('Cookie', authCookie)
      .expect(400);
  });

  it('rejects income category for expense transaction', async () => {
    const tx = await seedTransaction({
      description: 'Mercado',
      amount: '40.00',
      type: 'EXPENSE',
      categoryId: foodId,
      accountId: accountAId,
      competenceDate: '2026-01-10',
      dedupKey: 'patch-kind',
    });

    await request(app.getHttpServer())
      .patch(`/api/transactions/${tx.id}`)
      .set('Cookie', authCookie)
      .send({ categoryId: salaryId })
      .expect(400);
  });
});
