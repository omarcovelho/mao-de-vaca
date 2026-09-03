import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CategoryKind,
  Prisma,
  Transaction,
  TransactionType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ListTransactionsQuery,
  ListTransactionsResponse,
  RegimeApi,
  TransactionItemResponse,
  UpdateTransactionDto,
} from './transactions.types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type TransactionRow = Transaction & {
  category: {
    id: string;
    name: string;
    color: string;
    icon: string;
    kind: CategoryKind;
  };
  account: {
    id: string;
    label: string;
    bank: { id: string; name: string };
  } | null;
};

const accountInclude = {
  select: {
    id: true,
    label: true,
    bank: { select: { id: true, name: true } },
  },
} as const;

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async existingDedupKeys(
    userId: string,
    keys: string[],
  ): Promise<Set<string>> {
    if (keys.length === 0) {
      return new Set();
    }
    const rows = await this.prisma.transaction.findMany({
      where: { userId, dedupKey: { in: keys } },
      select: { dedupKey: true },
    });
    return new Set(rows.map((row) => row.dedupKey));
  }

  async createMany(data: Prisma.TransactionCreateManyInput[]): Promise<number> {
    if (data.length === 0) {
      return 0;
    }
    const result = await this.prisma.transaction.createMany({ data });
    return result.count;
  }

  async list(
    userId: string,
    query: ListTransactionsQuery,
  ): Promise<ListTransactionsResponse> {
    const from = query.from?.trim();
    const to = query.to?.trim();
    if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
      throw new BadRequestException(
        'Parâmetros from e to são obrigatórios (YYYY-MM-DD)',
      );
    }
    if (from > to) {
      throw new BadRequestException('from deve ser anterior ou igual a to');
    }

    const regime = this.parseRegime(query.regime);
    const dateField =
      regime === 'competence' ? 'competenceDate' : 'cashDate';
    const includeInactive = query.includeInactive === 'true';

    const rows = await this.prisma.transaction.findMany({
      where: {
        userId,
        ...(includeInactive ? {} : { active: true }),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.accountId ? { accountId: query.accountId } : {}),
        [dateField]: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
            kind: true,
          },
        },
        account: accountInclude,
      },
      orderBy: [{ [dateField]: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      regime,
      from,
      to,
      items: rows.map((row) => this.toItem(row as TransactionRow, regime)),
    };
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionItemResponse> {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Lançamento não encontrado');
    }

    const data: Prisma.TransactionUpdateInput = {};

    if (dto.categoryId !== undefined) {
      const categoryId = dto.categoryId.trim();
      if (!categoryId) {
        throw new BadRequestException('Categoria inválida');
      }
      await this.assertAssignableLeaf(userId, categoryId, existing.type);
      data.category = { connect: { id: categoryId } };
    }

    if (dto.active !== undefined) {
      if (typeof dto.active !== 'boolean') {
        throw new BadRequestException('active deve ser boolean');
      }
      data.active = dto.active;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nada para atualizar');
    }

    const updated = await this.prisma.transaction.update({
      where: { id },
      data,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
            kind: true,
          },
        },
        account: accountInclude,
      },
    });

    return this.toItem(updated as TransactionRow, 'competence');
  }

  private async assertAssignableLeaf(
    userId: string,
    categoryId: string,
    type: TransactionType,
  ): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId, active: true },
      include: { _count: { select: { children: true } } },
    });
    if (!category) {
      throw new BadRequestException('Categoria mapeada inválida');
    }
    if (category._count.children > 0) {
      throw new BadRequestException(
        'Lançamento deve referenciar uma categoria folha',
      );
    }
    if (type === TransactionType.EXPENSE && category.kind !== CategoryKind.EXPENSE) {
      throw new BadRequestException(
        'Categoria incompatível com o tipo do lançamento',
      );
    }
    if (type === TransactionType.INCOME && category.kind !== CategoryKind.INCOME) {
      throw new BadRequestException(
        'Categoria incompatível com o tipo do lançamento',
      );
    }
  }

  private parseRegime(value?: string): RegimeApi {
    if (!value || value === 'competence') {
      return 'competence';
    }
    if (value === 'cash') {
      return 'cash';
    }
    throw new BadRequestException('regime inválido');
  }

  private toIsoDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private toItem(
    row: TransactionRow,
    regime: RegimeApi,
  ): TransactionItemResponse {
    const competenceDate = this.toIsoDate(row.competenceDate);
    const cashDate = this.toIsoDate(row.cashDate);
    return {
      id: row.id,
      description: row.description,
      amount: Number(row.amount),
      type: row.type,
      competenceDate,
      cashDate,
      displayDate: regime === 'competence' ? competenceDate : cashDate,
      active: row.active,
      category: {
        id: row.category.id,
        name: row.category.name,
        color: row.category.color,
        icon: row.category.icon,
        kind: row.category.kind,
      },
      account: row.account
        ? {
            id: row.account.id,
            label: row.account.label,
            bank: {
              id: row.account.bank.id,
              name: row.account.bank.name,
            },
          }
        : null,
    };
  }
}
