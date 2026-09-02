import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AUTH_COOKIE_NAME,
  COOKIE_MAX_AGE_MS,
} from './auth.constants';

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

/** Extract `name=value` pairs suitable for a Cookie request header. */
function cookieHeaderFromSetCookie(setCookieHeaders: string[]): string {
  return setCookieHeaders.map((header) => header.split(';')[0]).join('; ');
}

describe('Auth HTTP', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const username = 'test-user';
  const password = 'test-password';

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
    jwtService = app.get(JwtService);

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { username },
      update: { passwordHash },
      create: { username, passwordHash },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { username } });
    await app.close();
  });

  it('POST /api/auth/login sets cookie and returns user on success', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password })
      .expect(200);

    expect(response.body).toEqual({
      id: expect.any(String),
      username,
    });

    const cookie = getSetCookie(response.headers as Record<string, unknown>);
    expect(cookie.length).toBeGreaterThan(0);
    expect(cookie[0]).toContain(`${AUTH_COOKIE_NAME}=`);
    expect(cookie[0]).toMatch(new RegExp(`Max-Age=${COOKIE_MAX_AGE_MS / 1000}`));
    expect(cookie[0]).toContain('HttpOnly');
  });

  it('POST /api/auth/login returns 401 for bad credentials', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password: 'wrong' })
      .expect(401);
  });

  it('GET /api/auth/me returns 401 without cookie', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('GET /api/auth/me returns current user when authenticated', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password })
      .expect(200);

    const cookie = cookieHeaderFromSetCookie(
      getSetCookie(login.headers as Record<string, unknown>),
    );

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(200);

    expect(me.body).toEqual({
      id: login.body.id,
      username,
    });
  });

  it('POST /api/auth/logout clears cookie and subsequent me returns 401', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password })
      .expect(200);

    const cookie = cookieHeaderFromSetCookie(
      getSetCookie(login.headers as Record<string, unknown>),
    );

    const logout = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', cookie)
      .expect(200);

    const cleared = getSetCookie(logout.headers as Record<string, unknown>);
    expect(cleared.length).toBeGreaterThan(0);
    expect(cleared[0]).toMatch(new RegExp(`${AUTH_COOKIE_NAME}=;`));

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `${AUTH_COOKIE_NAME}=expired-or-cleared`)
      .expect(401);
  });

  it('GET /api/auth/me returns 401 for expired JWT', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { username } });
    const expiredToken = await jwtService.signAsync(
      { sub: user.id, username },
      { expiresIn: '0s' },
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `${AUTH_COOKIE_NAME}=${expiredToken}`)
      .expect(401);
  });

  it('GET /api/health remains public', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.body).toEqual({ status: 'ok' });
  });
});
