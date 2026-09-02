import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AUTH_COOKIE_NAME,
  COOKIE_MAX_AGE_MS,
  JWT_EXPIRES_IN,
} from './auth.constants';
import { AuthUser, AuthUserResponse } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(
    username: string,
    password: string,
  ): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) {
      return null;
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return null;
    }

    return { userId: user.id, username: user.username };
  }

  async login(user: AuthUser, res: Response): Promise<AuthUserResponse> {
    const token = await this.jwtService.signAsync(
      { sub: user.userId, username: user.username },
      { expiresIn: JWT_EXPIRES_IN },
    );

    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE_MS,
      secure: process.env.NODE_ENV === 'production',
    });

    return { id: user.userId, username: user.username };
  }

  logout(res: Response): { ok: true } {
    res.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    });
    return { ok: true };
  }

  me(user: AuthUser | undefined): AuthUserResponse {
    if (!user) {
      throw new UnauthorizedException();
    }
    return { id: user.userId, username: user.username };
  }
}
