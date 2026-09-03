import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ByCategoryItem,
  ByCategoryResponse,
  MonthlyEvolutionQuery,
  MonthlyEvolutionResponse,
  RegimeApi,
  ReportPeriodQuery,
  SummaryResponse,
} from './reports.types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

type DateField = 'competenceDate' | 'cashDate';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(
    userId: string,
    query: ReportPeriodQuery,
  ): Promise<SummaryResponse> {
    const { regime, from, to, dateField } = this.parsePeriod(query);

    const rows = await this.prisma.transaction.findMany({
      where: this.baseWhere(userId, dateField, from, to),
      select: { type: true, amount: true },
    });

    let expenseTotal = 0;
    let incomeTotal = 0;
    for (const row of rows) {
      const amount = Math.abs(Number(row.amount));
      if (row.type === TransactionType.EXPENSE) {
        expenseTotal += amount;
      } else if (row.type === TransactionType.INCOME) {
        incomeTotal += amount;
      }
    }

    return {
      regime,
      from,
      to,
      expenseTotal: roundMoney(expenseTotal),
      incomeTotal: roundMoney(incomeTotal),
      balance: roundMoney(incomeTotal - expenseTotal),
    };
  }

  async byCategory(
    userId: string,
    query: ReportPeriodQuery,
  ): Promise<ByCategoryResponse> {
    const { regime, from, to, dateField } = this.parsePeriod(query);

    const [rows, categories] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          ...this.baseWhere(userId, dateField, from, to),
          type: TransactionType.EXPENSE,
        },
        select: {
          amount: true,
          categoryId: true,
        },
      }),
      this.prisma.category.findMany({
        where: { userId },
        select: {
          id: true,
          parentId: true,
          name: true,
          color: true,
          icon: true,
        },
      }),
    ]);

    const leafTotals = new Map<string, number>();
    for (const row of rows) {
      const amount = Math.abs(Number(row.amount));
      leafTotals.set(
        row.categoryId,
        (leafTotals.get(row.categoryId) ?? 0) + amount,
      );
    }

    const byId = new Map(
      categories.map((category) => [
        category.id,
        {
          id: category.id,
          parentId: category.parentId,
          name: category.name,
          color: category.color,
          icon: category.icon,
          total: 0,
          childrenIds: [] as string[],
        },
      ]),
    );

    for (const category of byId.values()) {
      if (category.parentId && byId.has(category.parentId)) {
        byId.get(category.parentId)!.childrenIds.push(category.id);
      }
    }

    for (const [categoryId, amount] of leafTotals) {
      let currentId: string | null = categoryId;
      while (currentId) {
        const node = byId.get(currentId);
        if (!node) {
          break;
        }
        node.total += amount;
        currentId = node.parentId;
      }
    }

    const expenseTotal = [...byId.values()]
      .filter((node) => !node.parentId)
      .reduce((sum, node) => sum + node.total, 0);

    const buildNode = (categoryId: string): ByCategoryItem | null => {
      const node = byId.get(categoryId);
      if (!node || node.total <= 0) {
        return null;
      }
      const children = node.childrenIds
        .map((childId) => buildNode(childId))
        .filter((child): child is ByCategoryItem => child !== null)
        .sort((a, b) => b.total - a.total);

      return {
        categoryId: node.id,
        name: node.name,
        color: node.color,
        icon: node.icon,
        total: roundMoney(node.total),
        percent:
          expenseTotal === 0
            ? 0
            : roundMoney((node.total / expenseTotal) * 100),
        children,
      };
    };

    const items = categories
      .filter((category) => category.parentId === null)
      .map((category) => buildNode(category.id))
      .filter((item): item is ByCategoryItem => item !== null)
      .sort((a, b) => b.total - a.total);

    return { regime, from, to, items };
  }

  async monthlyEvolution(
    userId: string,
    query: MonthlyEvolutionQuery,
  ): Promise<MonthlyEvolutionResponse> {
    const regime = this.parseRegime(query.regime);
    const dateField: DateField =
      regime === 'competence' ? 'competenceDate' : 'cashDate';

    const months = this.parseMonths(query.months);
    const endMonth = this.parseEndMonth(query.endMonth);
    const monthKeys = buildMonthKeys(endMonth, months);
    const from = `${monthKeys[0]}-01`;
    const to = monthEndIso(monthKeys[monthKeys.length - 1]);

    const rows = await this.prisma.transaction.findMany({
      where: this.baseWhere(userId, dateField, from, to),
      select: { type: true, amount: true, competenceDate: true, cashDate: true },
    });

    const buckets = new Map(
      monthKeys.map((month) => [
        month,
        { expenseTotal: 0, incomeTotal: 0 },
      ]),
    );

    for (const row of rows) {
      const date =
        dateField === 'competenceDate' ? row.competenceDate : row.cashDate;
      if (!date) {
        continue;
      }
      const month = toMonthKey(date);
      const bucket = buckets.get(month);
      if (!bucket) {
        continue;
      }
      const amount = Math.abs(Number(row.amount));
      if (row.type === TransactionType.EXPENSE) {
        bucket.expenseTotal += amount;
      } else if (row.type === TransactionType.INCOME) {
        bucket.incomeTotal += amount;
      }
    }

    return {
      regime,
      months,
      endMonth,
      items: monthKeys.map((month) => {
        const bucket = buckets.get(month)!;
        return {
          month,
          expenseTotal: roundMoney(bucket.expenseTotal),
          incomeTotal: roundMoney(bucket.incomeTotal),
        };
      }),
    };
  }

  private baseWhere(
    userId: string,
    dateField: DateField,
    from: string,
    to: string,
  ): Prisma.TransactionWhereInput {
    return {
      userId,
      active: true,
      type: { in: [TransactionType.EXPENSE, TransactionType.INCOME] },
      [dateField]: {
        gte: new Date(from),
        lte: new Date(to),
      },
    };
  }

  private parsePeriod(query: ReportPeriodQuery): {
    regime: RegimeApi;
    from: string;
    to: string;
    dateField: DateField;
  } {
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
    return {
      regime,
      from,
      to,
      dateField: regime === 'competence' ? 'competenceDate' : 'cashDate',
    };
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

  private parseMonths(value?: string): number {
    if (value === undefined || value === '') {
      return 6;
    }
    const months = Number(value);
    if (!Number.isInteger(months) || months < 1 || months > 24) {
      throw new BadRequestException('months deve ser inteiro entre 1 e 24');
    }
    return months;
  }

  private parseEndMonth(value?: string): string {
    if (!value || value.trim() === '') {
      return toMonthKey(new Date());
    }
    const endMonth = value.trim();
    if (!MONTH_RE.test(endMonth)) {
      throw new BadRequestException('endMonth deve ser YYYY-MM');
    }
    return endMonth;
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toMonthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function buildMonthKeys(endMonth: string, count: number): string[] {
  const [yearPart, monthPart] = endMonth.split('-');
  const end = new Date(Date.UTC(Number(yearPart), Number(monthPart) - 1, 1));
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1));
    keys.push(toMonthKey(d));
  }
  return keys;
}

function monthEndIso(monthKey: string): string {
  const [yearPart, monthPart] = monthKey.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${monthKey}-${String(lastDay).padStart(2, '0')}`;
}
