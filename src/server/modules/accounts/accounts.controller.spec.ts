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

describe('Accounts HTTP', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const username = 'accounts-test-user';
  const password = 'accounts-test-password';
  const otherUsername = 'accounts-other-user';

  let authCookie: string;
  let userId: string;
  let otherUserId: string;
  let bankId: string;
  let otherBankId: string;

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

    const otherHash = await bcrypt.hash('other-password', 10);
    const other = await prisma.user.upsert({
      where: { username: otherUsername },
      update: { passwordHash: otherHash },
      create: { username: otherUsername, passwordHash: otherHash },
    });
    otherUserId = other.id;

    const bank = await prisma.bank.upsert({
      where: { userId_name: { userId, name: 'Nubank' } },
      update: {},
      create: { userId, name: 'Nubank' },
    });
    bankId = bank.id;

    const otherBank = await prisma.bank.upsert({
      where: { userId_name: { userId: otherUserId, name: 'Foreign Bank' } },
      update: {},
      create: { userId: otherUserId, name: 'Foreign Bank' },
    });
    otherBankId = otherBank.id;

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password })
      .expect(200);

    authCookie = cookieHeaderFromSetCookie(
      getSetCookie(login.headers as Record<string, unknown>),
    );
  });

  beforeEach(async () => {
    await prisma.transaction.deleteMany({
      where: { userId: { in: [userId, otherUserId] } },
    });
    await prisma.importBatch.deleteMany({
      where: { userId: { in: [userId, otherUserId] } },
    });
    await prisma.account.deleteMany({
      where: { userId: { in: [userId, otherUserId] } },
    });
    await prisma.card.deleteMany({
      where: { userId: { in: [userId, otherUserId] } },
    });
    await prisma.bank.deleteMany({
      where: {
        userId: { in: [userId, otherUserId] },
        name: { notIn: ['Nubank', 'Foreign Bank'] },
      },
    });
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({
      where: { userId: { in: [userId, otherUserId] } },
    });
    await prisma.importBatch.deleteMany({
      where: { userId: { in: [userId, otherUserId] } },
    });
    await prisma.account.deleteMany({
      where: { userId: { in: [userId, otherUserId] } },
    });
    await prisma.card.deleteMany({
      where: { userId: { in: [userId, otherUserId] } },
    });
    await prisma.category.deleteMany({
      where: { userId: { in: [userId, otherUserId] } },
    });
    await prisma.bank.deleteMany({
      where: { userId: { in: [userId, otherUserId] } },
    });
    await prisma.user.deleteMany({
      where: { username: { in: [username, otherUsername] } },
    });
    await app.close();
  });

  it('GET /api/setup/status returns 401 without cookie', async () => {
    await request(app.getHttpServer()).get('/api/setup/status').expect(401);
  });

  it('GET /api/setup/status is empty when user has no origins', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/setup/status')
      .set('Cookie', authCookie)
      .expect(200);

    expect(response.body).toEqual({
      hasAccounts: false,
      hasCards: false,
      hasCategories: false,
      readyForImport: false,
    });
  });

  it('GET /api/banks lists banks for the user', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/banks')
      .set('Cookie', authCookie)
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: bankId, name: 'Nubank' }),
      ]),
    );
  });

  it('POST /api/banks creates a bank and rejects duplicates', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/banks')
      .set('Cookie', authCookie)
      .send({ name: 'Bradesco' })
      .expect(201);

    expect(created.body).toEqual({
      id: expect.any(String),
      name: 'Bradesco',
    });

    await request(app.getHttpServer())
      .post('/api/banks')
      .set('Cookie', authCookie)
      .send({ name: 'Bradesco' })
      .expect(409);
  });

  it('POST /api/accounts creates an account and updates setup status', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Cookie', authCookie)
      .send({ label: 'Nubank CC', bankId })
      .expect(201);

    expect(created.body).toMatchObject({
      id: expect.any(String),
      label: 'Nubank CC',
      bankId,
      bank: { id: bankId, name: 'Nubank' },
      active: true,
    });

    const list = await request(app.getHttpServer())
      .get('/api/accounts')
      .set('Cookie', authCookie)
      .expect(200);

    expect(list.body).toHaveLength(1);
    expect(list.body[0].bank.name).toBe('Nubank');

    const status = await request(app.getHttpServer())
      .get('/api/setup/status')
      .set('Cookie', authCookie)
      .expect(200);

    expect(status.body).toMatchObject({
      hasAccounts: true,
      hasCards: false,
      readyForImport: true,
    });
  });

  it('POST /api/accounts rejects bank from another user', async () => {
    await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Cookie', authCookie)
      .send({ label: 'Hacked', bankId: otherBankId })
      .expect(404);
  });

  it('PATCH /api/accounts/:id deactivates and hides from default list', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Cookie', authCookie)
      .send({ label: 'Conta Itaú', bankId })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/accounts/${created.body.id}`)
      .set('Cookie', authCookie)
      .send({ active: false })
      .expect(200);

    const activeOnly = await request(app.getHttpServer())
      .get('/api/accounts')
      .set('Cookie', authCookie)
      .expect(200);

    expect(activeOnly.body).toHaveLength(0);

    const withInactive = await request(app.getHttpServer())
      .get('/api/accounts?includeInactive=true')
      .set('Cookie', authCookie)
      .expect(200);

    expect(withInactive.body).toHaveLength(1);
    expect(withInactive.body[0].active).toBe(false);
  });

  it('PATCH /api/accounts/:id returns 404 for another user account', async () => {
    const foreign = await prisma.account.create({
      data: {
        userId: otherUserId,
        bankId: otherBankId,
        label: 'Foreign',
      },
    });

    await request(app.getHttpServer())
      .patch(`/api/accounts/${foreign.id}`)
      .set('Cookie', authCookie)
      .send({ label: 'Hacked' })
      .expect(404);
  });

  it('POST /api/cards creates a card and updates setup status', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/cards')
      .set('Cookie', authCookie)
      .send({ label: 'Visa Nubank', bankId })
      .expect(201);

    expect(created.body).toMatchObject({
      id: expect.any(String),
      label: 'Visa Nubank',
      bankId,
      bank: { id: bankId, name: 'Nubank' },
      active: true,
    });

    const status = await request(app.getHttpServer())
      .get('/api/setup/status')
      .set('Cookie', authCookie)
      .expect(200);

    expect(status.body).toMatchObject({
      hasAccounts: false,
      hasCards: true,
      readyForImport: false,
    });
  });

  it('PATCH /api/cards/:id deactivates and hides from default list', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/cards')
      .set('Cookie', authCookie)
      .send({ label: 'Mastercard', bankId })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/cards/${created.body.id}`)
      .set('Cookie', authCookie)
      .send({ active: false })
      .expect(200);

    const activeOnly = await request(app.getHttpServer())
      .get('/api/cards')
      .set('Cookie', authCookie)
      .expect(200);

    expect(activeOnly.body).toHaveLength(0);

    const withInactive = await request(app.getHttpServer())
      .get('/api/cards?includeInactive=true')
      .set('Cookie', authCookie)
      .expect(200);

    expect(withInactive.body).toHaveLength(1);
    expect(withInactive.body[0].active).toBe(false);
  });

  it('PATCH /api/cards/:id returns 404 for another user card', async () => {
    const foreign = await prisma.card.create({
      data: {
        userId: otherUserId,
        bankId: otherBankId,
        label: 'Foreign Card',
      },
    });

    await request(app.getHttpServer())
      .patch(`/api/cards/${foreign.id}`)
      .set('Cookie', authCookie)
      .send({ label: 'Hacked' })
      .expect(404);
  });

  it('GET /api/accounts and /api/cards return 401 without cookie', async () => {
    await request(app.getHttpServer()).get('/api/accounts').expect(401);
    await request(app.getHttpServer()).get('/api/cards').expect(401);
  });
});
