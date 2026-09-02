import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BankResponse,
  CreateBankDto,
  CreateOriginDto,
  OriginResponse,
  SetupStatus,
  UpdateOriginDto,
} from './accounts.types';

type OriginWithBank = {
  id: string;
  label: string;
  bankId: string;
  active: boolean;
  bank: { id: string; name: string };
};

function toBankResponse(row: { id: string; name: string }): BankResponse {
  return { id: row.id, name: row.name };
}

function toOriginResponse(row: OriginWithBank): OriginResponse {
  return {
    id: row.id,
    label: row.label,
    bankId: row.bankId,
    bank: toBankResponse(row.bank),
    active: row.active,
  };
}

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSetupStatus(userId: string): Promise<SetupStatus> {
    const [accountCount, cardCount] = await Promise.all([
      this.prisma.account.count({ where: { userId, active: true } }),
      this.prisma.card.count({ where: { userId, active: true } }),
    ]);

    const hasAccounts = accountCount > 0;
    const hasCards = cardCount > 0;

    return {
      hasAccounts,
      hasCards,
      hasCategories: false,
      readyForImport: hasAccounts,
    };
  }

  async listBanks(userId: string): Promise<BankResponse[]> {
    const banks = await this.prisma.bank.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
    return banks.map(toBankResponse);
  }

  async createBank(
    userId: string,
    dto: CreateBankDto,
  ): Promise<BankResponse> {
    const name = dto.name.trim();
    try {
      const bank = await this.prisma.bank.create({
        data: { userId, name },
      });
      return toBankResponse(bank);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Banco já cadastrado');
      }
      throw error;
    }
  }

  private async requireBank(userId: string, bankId: string) {
    const bank = await this.prisma.bank.findFirst({
      where: { id: bankId, userId },
    });
    if (!bank) {
      throw new NotFoundException('Banco não encontrado');
    }
    return bank;
  }

  async listAccounts(
    userId: string,
    includeInactive = false,
  ): Promise<OriginResponse[]> {
    const accounts = await this.prisma.account.findMany({
      where: {
        userId,
        ...(includeInactive ? {} : { active: true }),
      },
      include: { bank: true },
      orderBy: { createdAt: 'asc' },
    });
    return accounts.map(toOriginResponse);
  }

  async createAccount(
    userId: string,
    dto: CreateOriginDto,
  ): Promise<OriginResponse> {
    await this.requireBank(userId, dto.bankId);
    const account = await this.prisma.account.create({
      data: {
        userId,
        label: dto.label,
        bankId: dto.bankId,
      },
      include: { bank: true },
    });
    return toOriginResponse(account);
  }

  async updateAccount(
    userId: string,
    id: string,
    dto: UpdateOriginDto,
  ): Promise<OriginResponse> {
    const existing = await this.prisma.account.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException();
    }

    if (dto.bankId !== undefined) {
      await this.requireBank(userId, dto.bankId);
    }

    const account = await this.prisma.account.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.bankId !== undefined ? { bankId: dto.bankId } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
      include: { bank: true },
    });
    return toOriginResponse(account);
  }

  async listCards(
    userId: string,
    includeInactive = false,
  ): Promise<OriginResponse[]> {
    const cards = await this.prisma.card.findMany({
      where: {
        userId,
        ...(includeInactive ? {} : { active: true }),
      },
      include: { bank: true },
      orderBy: { createdAt: 'asc' },
    });
    return cards.map(toOriginResponse);
  }

  async createCard(
    userId: string,
    dto: CreateOriginDto,
  ): Promise<OriginResponse> {
    await this.requireBank(userId, dto.bankId);
    const card = await this.prisma.card.create({
      data: {
        userId,
        label: dto.label,
        bankId: dto.bankId,
      },
      include: { bank: true },
    });
    return toOriginResponse(card);
  }

  async updateCard(
    userId: string,
    id: string,
    dto: UpdateOriginDto,
  ): Promise<OriginResponse> {
    const existing = await this.prisma.card.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException();
    }

    if (dto.bankId !== undefined) {
      await this.requireBank(userId, dto.bankId);
    }

    const card = await this.prisma.card.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.bankId !== undefined ? { bankId: dto.bankId } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
      include: { bank: true },
    });
    return toOriginResponse(card);
  }
}
