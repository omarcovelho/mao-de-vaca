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

describe('Categories HTTP', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const username = 'categories-test-user';
  const password = 'categories-test-password';
  const otherUsername = 'categories-other-user';

  let authCookie: string;
  let userId: string;
  let otherUserId: string;

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

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password })
      .expect(200);

    authCookie = cookieHeaderFromSetCookie(
      getSetCookie(login.headers as Record<string, unknown>),
    );
  });

  beforeEach(async () => {
    await prisma.transferLink.deleteMany({
      where: { userId: { in: [userId, otherUserId] } },
    });
    await prisma.transaction.deleteMany({
      where: { userId: { in: [userId, otherUserId] } },
    });
    await prisma.importBatch.deleteMany({
      where: { userId: { in: [userId, otherUserId] } },
    });
    await prisma.category.deleteMany({
      where: { userId: { in: [userId, otherUserId] } },
    });
  });

  afterAll(async () => {
    await prisma.transferLink.deleteMany({
      where: { userId: { in: [userId, otherUserId] } },
    });
    await prisma.transaction.deleteMany({
      where: { userId: { in: [userId, otherUserId] } },
    });
    await prisma.importBatch.deleteMany({
      where: { userId: { in: [userId, otherUserId] } },
    });
    await prisma.category.deleteMany({
      where: { userId: { in: [userId, otherUserId] } },
    });
    await prisma.user.deleteMany({
      where: { username: { in: [username, otherUsername] } },
    });
    await app.close();
  });

  it('GET /api/categories returns 401 without cookie', async () => {
    await request(app.getHttpServer()).get('/api/categories').expect(401);
  });

  it('creates root and child; child inherits color/icon/kind', async () => {
    const root = await request(app.getHttpServer())
      .post('/api/categories')
      .set('Cookie', authCookie)
      .send({
        name: 'Alimentação',
        kind: 'EXPENSE',
        color: '#DD6B20',
        icon: 'utensils',
      })
      .expect(201);

    expect(root.body).toMatchObject({
      name: 'Alimentação',
      kind: 'EXPENSE',
      color: '#DD6B20',
      icon: 'utensils',
      parentId: null,
      depth: 1,
      isLeaf: true,
      active: true,
    });

    const child = await request(app.getHttpServer())
      .post('/api/categories')
      .set('Cookie', authCookie)
      .send({ name: 'Supermercado', parentId: root.body.id })
      .expect(201);

    expect(child.body).toMatchObject({
      name: 'Supermercado',
      parentId: root.body.id,
      kind: 'EXPENSE',
      color: '#DD6B20',
      icon: 'utensils',
      depth: 2,
      isLeaf: true,
    });

    const tree = await request(app.getHttpServer())
      .get('/api/categories')
      .set('Cookie', authCookie)
      .expect(200);

    const alimentacao = tree.body.find(
      (n: { name: string }) => n.name === 'Alimentação',
    );
    expect(alimentacao).toBeDefined();
    expect(alimentacao.children).toHaveLength(1);
    expect(alimentacao.isLeaf).toBe(false);
    expect(alimentacao.children[0].name).toBe('Supermercado');
  });

  it('rejects duplicate sibling names with 409', async () => {
    await request(app.getHttpServer())
      .post('/api/categories')
      .set('Cookie', authCookie)
      .send({
        name: 'Saúde',
        kind: 'EXPENSE',
        color: '#E53E3E',
        icon: 'heart',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/categories')
      .set('Cookie', authCookie)
      .send({
        name: 'Saúde',
        kind: 'EXPENSE',
        color: '#E53E3E',
        icon: 'heart',
      })
      .expect(409);
  });

  it('updates name, color and icon', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/categories')
      .set('Cookie', authCookie)
      .send({
        name: 'Lazer',
        kind: 'EXPENSE',
        color: '#9F7AEA',
        icon: 'ticket',
      })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/api/categories/${created.body.id}`)
      .set('Cookie', authCookie)
      .send({ name: 'Lazer/Entretenimento', color: '#805AD5', icon: 'sparkles' })
      .expect(200);

    expect(updated.body).toMatchObject({
      name: 'Lazer/Entretenimento',
      color: '#805AD5',
      icon: 'sparkles',
    });
  });

  it('deactivates parent and cascades to children', async () => {
    const root = await request(app.getHttpServer())
      .post('/api/categories')
      .set('Cookie', authCookie)
      .send({
        name: 'Transporte',
        kind: 'EXPENSE',
        color: '#3182CE',
        icon: 'car',
      })
      .expect(201);

    const child = await request(app.getHttpServer())
      .post('/api/categories')
      .set('Cookie', authCookie)
      .send({ name: 'Combustível', parentId: root.body.id })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/categories/${root.body.id}`)
      .set('Cookie', authCookie)
      .send({ active: false })
      .expect(200);

    const activeTree = await request(app.getHttpServer())
      .get('/api/categories')
      .set('Cookie', authCookie)
      .expect(200);
    expect(
      activeTree.body.filter((n: { kind: string }) => n.kind === 'EXPENSE'),
    ).toHaveLength(0);
    expect(
      activeTree.body.some(
        (n: { systemKey: string | null }) => n.systemKey === 'NON_EXPENSE_ROOT',
      ),
    ).toBe(true);

    const all = await request(app.getHttpServer())
      .get('/api/categories?includeInactive=true')
      .set('Cookie', authCookie)
      .expect(200);
    const transporte = all.body.find(
      (n: { name: string }) => n.name === 'Transporte',
    );
    expect(transporte.active).toBe(false);
    expect(transporte.children[0].id).toBe(child.body.id);
    expect(transporte.children[0].active).toBe(false);
  });

  it('rejects depth greater than 5', async () => {
    let parentId: string | undefined;
    for (let depth = 1; depth <= 5; depth += 1) {
      const res: { body: { id: string } } = await request(app.getHttpServer())
        .post('/api/categories')
        .set('Cookie', authCookie)
        .send(
          parentId
            ? { name: `Nível ${depth}`, parentId }
            : {
                name: `Nível ${depth}`,
                kind: 'EXPENSE',
                color: '#4A5568',
                icon: 'tag',
              },
        )
        .expect(201);
      parentId = res.body.id;
    }

    await request(app.getHttpServer())
      .post('/api/categories')
      .set('Cookie', authCookie)
      .send({ name: 'Nível 6', parentId })
      .expect(400);
  });

  it('rejects invalid color and icon', async () => {
    await request(app.getHttpServer())
      .post('/api/categories')
      .set('Cookie', authCookie)
      .send({
        name: 'X',
        kind: 'EXPENSE',
        color: 'red',
        icon: 'utensils',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/categories')
      .set('Cookie', authCookie)
      .send({
        name: 'Y',
        kind: 'EXPENSE',
        color: '#112233',
        icon: 'not-a-real-icon',
      })
      .expect(400);
  });

  it('setup/status hasCategories reflects active leaves', async () => {
    const empty = await request(app.getHttpServer())
      .get('/api/setup/status')
      .set('Cookie', authCookie)
      .expect(200);
    expect(empty.body.hasCategories).toBe(false);

    const root = await request(app.getHttpServer())
      .post('/api/categories')
      .set('Cookie', authCookie)
      .send({
        name: 'Renda',
        kind: 'INCOME',
        color: '#276749',
        icon: 'wallet',
      })
      .expect(201);

    const withRootLeaf = await request(app.getHttpServer())
      .get('/api/setup/status')
      .set('Cookie', authCookie)
      .expect(200);
    expect(withRootLeaf.body.hasCategories).toBe(true);

    await request(app.getHttpServer())
      .post('/api/categories')
      .set('Cookie', authCookie)
      .send({ name: 'Salário', parentId: root.body.id })
      .expect(201);

    const withChild = await request(app.getHttpServer())
      .get('/api/setup/status')
      .set('Cookie', authCookie)
      .expect(200);
    expect(withChild.body.hasCategories).toBe(true);

    await request(app.getHttpServer())
      .patch(`/api/categories/${root.body.id}`)
      .set('Cookie', authCookie)
      .send({ active: false })
      .expect(200);

    const afterDeactivate = await request(app.getHttpServer())
      .get('/api/setup/status')
      .set('Cookie', authCookie)
      .expect(200);
    expect(afterDeactivate.body.hasCategories).toBe(false);
  });

  it('does not expose another user categories', async () => {
    await prisma.category.create({
      data: {
        userId: otherUserId,
        name: 'Foreign',
        kind: 'EXPENSE',
        color: '#000000',
        icon: 'tag',
      },
    });

    const tree = await request(app.getHttpServer())
      .get('/api/categories')
      .set('Cookie', authCookie)
      .expect(200);
    const expenseRoots = tree.body.filter(
      (n: { kind: string }) => n.kind === 'EXPENSE',
    );
    expect(expenseRoots).toHaveLength(0);
    expect(
      tree.body.some((n: { name: string }) => n.name === 'Foreign'),
    ).toBe(false);
  });

  it('GET /api/categories always provisions system NON_EXPENSE tree', async () => {
    const tree = await request(app.getHttpServer())
      .get('/api/categories')
      .set('Cookie', authCookie)
      .expect(200);

    const root = tree.body.find(
      (n: { systemKey: string | null }) => n.systemKey === 'NON_EXPENSE_ROOT',
    );
    expect(root).toMatchObject({
      name: 'Não-despesa',
      kind: 'NON_EXPENSE',
      systemKey: 'NON_EXPENSE_ROOT',
    });
    const leafKeys = (root.children ?? []).map(
      (c: { systemKey: string }) => c.systemKey,
    );
    expect(leafKeys.sort()).toEqual(
      ['ACCOUNT_TRANSFER', 'INVESTMENT', 'INVOICE_PAYMENT'].sort(),
    );
  });

  it('rejects creating NON_EXPENSE root or children under system root', async () => {
    await request(app.getHttpServer())
      .post('/api/categories')
      .set('Cookie', authCookie)
      .send({
        name: 'Outra não-despesa',
        kind: 'NON_EXPENSE',
        color: '#718096',
        icon: 'arrows',
      })
      .expect(400);

    const tree = await request(app.getHttpServer())
      .get('/api/categories')
      .set('Cookie', authCookie)
      .expect(200);
    const root = tree.body.find(
      (n: { systemKey: string | null }) => n.systemKey === 'NON_EXPENSE_ROOT',
    );

    await request(app.getHttpServer())
      .post('/api/categories')
      .set('Cookie', authCookie)
      .send({ name: 'Extra', parentId: root.id })
      .expect(400);
  });

  it('rejects deactivating or renaming system categories', async () => {
    const tree = await request(app.getHttpServer())
      .get('/api/categories')
      .set('Cookie', authCookie)
      .expect(200);
    const root = tree.body.find(
      (n: { systemKey: string | null }) => n.systemKey === 'NON_EXPENSE_ROOT',
    );
    const transfer = root.children.find(
      (c: { systemKey: string }) => c.systemKey === 'ACCOUNT_TRANSFER',
    );

    await request(app.getHttpServer())
      .patch(`/api/categories/${transfer.id}`)
      .set('Cookie', authCookie)
      .send({ active: false })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/categories/${transfer.id}`)
      .set('Cookie', authCookie)
      .send({ name: 'Outro nome' })
      .expect(400);
  });
});
