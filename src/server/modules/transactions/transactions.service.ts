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
import { SYSTEM_CATEGORY_KEYS } from '../categories/system-categories';
import {
  ListTransactionsQuery,
  ListTransactionsResponse,
  RegimeApi,
  TransactionItemResponse,
  TransferCandidatesQuery,
  TransferCandidatesResponse,
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
    systemKey: string | null;
  } | null;
  account: {
    id: string;
    label: string;
    bank: { id: string; name: string };
  } | null;
  card: {
    id: string;
    label: string;
    bank: { id: string; name: string };
  } | null;
  invoicePaymentLink: { invoiceId: string } | null;
  transferDebitLink: { creditTransactionId: string } | null;
  transferCreditLink: { debitTransactionId: string } | null;
};

const originInclude = {
  select: {
    id: true,
    label: true,
    bank: { select: { id: true, name: true } },
  },
} as const;

const transactionInclude = {
  category: {
    select: {
      id: true,
      name: true,
      color: true,
      icon: true,
      kind: true,
      systemKey: true,
    },
  },
  account: originInclude,
  card: originInclude,
  invoicePaymentLink: { select: { invoiceId: true } },
  transferDebitLink: { select: { creditTransactionId: true } },
  transferCreditLink: { select: { debitTransactionId: true } },
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
    const cardId = query.cardId?.trim();
    const accountId = query.accountId?.trim();
    const q = query.q?.trim();
    const selectedCategoryIds = this.normalizeCategoryIds(query.categoryId);

    const categoryIds =
      selectedCategoryIds.length > 0
        ? await this.resolveCategoryFilterIds(userId, selectedCategoryIds)
        : null;

    const rows = await this.prisma.transaction.findMany({
      where: {
        userId,
        ...(includeInactive ? {} : { active: true }),
        ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
        ...(accountId ? { accountId } : {}),
        ...(cardId ? { cardId } : {}),
        ...(q
          ? { description: { contains: q, mode: 'insensitive' } }
          : {}),
        [dateField]: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
      include: transactionInclude,
      orderBy: [{ [dateField]: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      regime,
      from,
      to,
      items: rows.map((row) => this.toItem(row as TransactionRow, regime)),
    };
  }

  private normalizeCategoryIds(raw?: string | string[]): string[] {
    if (raw == null) {
      return [];
    }
    const list = Array.isArray(raw) ? raw : [raw];
    return [
      ...new Set(
        list.map((id) => id.trim()).filter((id) => id.length > 0),
      ),
    ];
  }

  /** Union of subtrees for each selected id. Missing ids contribute nothing. */
  private async resolveCategoryFilterIds(
    userId: string,
    categoryIds: string[],
  ): Promise<string[]> {
    const all = await this.prisma.category.findMany({
      where: { userId },
      select: { id: true, parentId: true },
    });
    const childrenByParent = new Map<string, string[]>();
    for (const row of all) {
      if (!row.parentId) continue;
      const list = childrenByParent.get(row.parentId) ?? [];
      list.push(row.id);
      childrenByParent.set(row.parentId, list);
    }
    const known = new Set(all.map((row) => row.id));
    const resolved = new Set<string>();
    const walk = (id: string) => {
      resolved.add(id);
      for (const childId of childrenByParent.get(id) ?? []) {
        walk(childId);
      }
    };
    for (const id of categoryIds) {
      if (!known.has(id)) {
        continue;
      }
      walk(id);
    }
    return [...resolved];
  }

  async listTransferCandidates(
    userId: string,
    query: TransferCandidatesQuery,
  ): Promise<TransferCandidatesResponse> {
    const transactionId = query.transactionId?.trim();
    if (!transactionId) {
      throw new BadRequestException('transactionId é obrigatório');
    }

    const source = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId, active: true },
    });
    if (!source) {
      throw new NotFoundException('Lançamento não encontrado');
    }
    if (!source.accountId) {
      throw new BadRequestException(
        'Transferência entre contas exige lançamento de conta',
      );
    }

    const amountFilter = query.amount?.trim();
    let absAmount = Math.abs(Number(source.amount));
    if (amountFilter) {
      const normalized = Number(amountFilter.replace(',', '.'));
      if (!Number.isFinite(normalized) || normalized === 0) {
        throw new BadRequestException('amount inválido');
      }
      absAmount = Math.abs(normalized);
    }

    const sourceAmount = Number(source.amount);
    const oppositeSign = sourceAmount < 0 ? 'gt' : 'lt';

    const candidates = await this.prisma.transaction.findMany({
      where: {
        userId,
        active: true,
        id: { not: source.id },
        accountId: { not: null },
        cardId: null,
        type: { in: [TransactionType.EXPENSE, TransactionType.INCOME] },
        invoicePaymentLink: null,
        transferDebitLink: null,
        transferCreditLink: null,
        amount: {
          [oppositeSign]: 0,
        },
      },
      include: transactionInclude,
      orderBy: [{ competenceDate: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });

    const matched = candidates
      .filter(
        (row) => Math.abs(Math.abs(Number(row.amount)) - absAmount) < 0.001,
      )
      .sort((a, b) => {
        const aSameAccount = a.accountId === source.accountId ? 1 : 0;
        const bSameAccount = b.accountId === source.accountId ? 1 : 0;
        if (aSameAccount !== bSameAccount) {
          return aSameAccount - bSameAccount;
        }
        const aDiff = Math.abs(
          a.competenceDate.getTime() - source.competenceDate.getTime(),
        );
        const bDiff = Math.abs(
          b.competenceDate.getTime() - source.competenceDate.getTime(),
        );
        return aDiff - bDiff;
      });

    return {
      items: matched.map((row) =>
        this.toItem(row as TransactionRow, 'competence'),
      ),
    };
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionItemResponse> {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, userId },
      include: {
        transferDebitLink: {
          select: { id: true, creditTransactionId: true },
        },
        transferCreditLink: {
          select: { id: true, debitTransactionId: true },
        },
        invoicePaymentLink: { select: { id: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException('Lançamento não encontrado');
    }

    if (dto.categoryId !== undefined) {
      const categoryId = dto.categoryId.trim();
      if (!categoryId) {
        throw new BadRequestException('Categoria inválida');
      }
      return this.updateCategory(
        userId,
        existing,
        categoryId,
        dto.counterpartTransactionId?.trim(),
      );
    }

    if (dto.active !== undefined) {
      if (typeof dto.active !== 'boolean') {
        throw new BadRequestException('active deve ser boolean');
      }
      const updated = await this.prisma.transaction.update({
        where: { id },
        data: { active: dto.active },
        include: transactionInclude,
      });
      return this.toItem(updated as TransactionRow, 'competence');
    }

    throw new BadRequestException('Nada para atualizar');
  }

  private async updateCategory(
    userId: string,
    existing: Transaction & {
      transferDebitLink: {
        id: string;
        creditTransactionId: string;
      } | null;
      transferCreditLink: {
        id: string;
        debitTransactionId: string;
      } | null;
      invoicePaymentLink: { id: string } | null;
    },
    categoryId: string,
    counterpartTransactionId?: string,
  ): Promise<TransactionItemResponse> {
    if (existing.invoicePaymentLink) {
      throw new BadRequestException(
        'Pagamento de fatura não pode ser reclassificado por aqui',
      );
    }

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

    if (category.kind === CategoryKind.NON_EXPENSE) {
      if (category.systemKey === SYSTEM_CATEGORY_KEYS.INVOICE_PAYMENT) {
        throw new BadRequestException(
          'Pagamento de fatura só pode ser classificado pelo vínculo na fatura',
        );
      }
      if (category.systemKey === SYSTEM_CATEGORY_KEYS.ACCOUNT_TRANSFER) {
        if (!counterpartTransactionId) {
          throw new BadRequestException(
            'Informe o lançamento correspondente da transferência',
          );
        }
        return this.linkAccountTransfer(
          userId,
          existing,
          category.id,
          counterpartTransactionId,
        );
      }
      if (category.systemKey === SYSTEM_CATEGORY_KEYS.INVESTMENT) {
        return this.applyCategoryToLinkedPair(existing, {
          categoryId: category.id,
          typeMode: 'fixed',
          type: TransactionType.TRANSFER,
        });
      }
      throw new BadRequestException('Categoria Não-despesa inválida');
    }

    if (category.kind === CategoryKind.EXPENSE) {
      return this.applyCategoryToLinkedPair(existing, {
        categoryId: category.id,
        typeMode: 'by_sign',
      });
    }

    if (category.kind === CategoryKind.INCOME) {
      return this.applyCategoryToLinkedPair(existing, {
        categoryId: category.id,
        typeMode: 'by_sign',
      });
    }

    throw new BadRequestException('Categoria incompatível');
  }

  private counterpartIdFromLink(
    existing: Transaction & {
      transferDebitLink: {
        id: string;
        creditTransactionId: string;
      } | null;
      transferCreditLink: {
        id: string;
        debitTransactionId: string;
      } | null;
    },
  ): string | null {
    return (
      existing.transferDebitLink?.creditTransactionId ??
      existing.transferCreditLink?.debitTransactionId ??
      null
    );
  }

  private typeFromAmountSign(amount: Prisma.Decimal | number): TransactionType {
    return Number(amount) < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
  }

  private async applyCategoryToLinkedPair(
    existing: Transaction & {
      transferDebitLink: {
        id: string;
        creditTransactionId: string;
      } | null;
      transferCreditLink: {
        id: string;
        debitTransactionId: string;
      } | null;
    },
    data:
      | {
          categoryId: string;
          typeMode: 'fixed';
          type: TransactionType;
        }
      | {
          categoryId: string;
          typeMode: 'by_sign';
        },
  ): Promise<TransactionItemResponse> {
    const counterpartId = this.counterpartIdFromLink(existing);
    const linkId =
      existing.transferDebitLink?.id ?? existing.transferCreditLink?.id;

    const sourceType =
      data.typeMode === 'fixed'
        ? data.type
        : this.typeFromAmountSign(existing.amount);

    let counterpartAmount: Prisma.Decimal | number | null = null;
    if (counterpartId) {
      const counterpart = await this.prisma.transaction.findFirst({
        where: { id: counterpartId },
        select: { amount: true },
      });
      counterpartAmount = counterpart?.amount ?? null;
    }

    await this.prisma.$transaction(async (tx) => {
      if (linkId) {
        await tx.transferLink.delete({ where: { id: linkId } });
      }
      await tx.transaction.update({
        where: { id: existing.id },
        data: {
          categoryId: data.categoryId,
          type: sourceType,
        },
      });
      if (counterpartId && counterpartAmount !== null) {
        await tx.transaction.update({
          where: { id: counterpartId },
          data: {
            categoryId: data.categoryId,
            type:
              data.typeMode === 'fixed'
                ? data.type
                : this.typeFromAmountSign(counterpartAmount),
          },
        });
      }
    });

    const updated = await this.prisma.transaction.findFirstOrThrow({
      where: { id: existing.id },
      include: transactionInclude,
    });
    return this.toItem(updated as TransactionRow, 'competence');
  }

  private async linkAccountTransfer(
    userId: string,
    source: Transaction & {
      transferDebitLink: {
        id: string;
        creditTransactionId: string;
      } | null;
      transferCreditLink: {
        id: string;
        debitTransactionId: string;
      } | null;
    },
    transferCategoryId: string,
    counterpartId: string,
  ): Promise<TransactionItemResponse> {
    if (source.transferDebitLink || source.transferCreditLink) {
      await this.clearTransferLink(source);
      source = {
        ...source,
        transferDebitLink: null,
        transferCreditLink: null,
      };
    }
    if (!source.accountId || source.cardId) {
      throw new BadRequestException(
        'Transferência entre contas exige lançamento de conta',
      );
    }

    const counterpart = await this.prisma.transaction.findFirst({
      where: { id: counterpartId, userId },
      include: {
        transferDebitLink: true,
        transferCreditLink: true,
        invoicePaymentLink: true,
      },
    });
    if (!counterpart) {
      throw new BadRequestException('Lançamento correspondente não encontrado');
    }
    if (!counterpart.active) {
      throw new BadRequestException('Lançamento correspondente inativo');
    }
    if (!counterpart.accountId || counterpart.cardId) {
      throw new BadRequestException(
        'Correspondente deve ser um lançamento de conta',
      );
    }
    if (counterpart.accountId === source.accountId) {
      throw new BadRequestException(
        'Transferência deve vincular contas distintas',
      );
    }
    if (counterpart.invoicePaymentLink) {
      throw new BadRequestException(
        'Correspondente já está vinculado a uma fatura',
      );
    }
    if (counterpart.transferDebitLink || counterpart.transferCreditLink) {
      throw new BadRequestException(
        'Correspondente já possui vínculo de transferência',
      );
    }

    const sourceAmount = Number(source.amount);
    const counterpartAmount = Number(counterpart.amount);
    if (sourceAmount === 0 || counterpartAmount === 0) {
      throw new BadRequestException('Valor inválido para transferência');
    }
    if (Math.sign(sourceAmount) === Math.sign(counterpartAmount)) {
      throw new BadRequestException(
        'Lançamentos da transferência devem ter sinais opostos',
      );
    }
    if (Math.abs(Math.abs(sourceAmount) - Math.abs(counterpartAmount)) > 0.001) {
      throw new BadRequestException(
        'Valores absolutos da transferência devem ser iguais',
      );
    }

    const debit = sourceAmount < 0 ? source : counterpart;
    const credit = sourceAmount < 0 ? counterpart : source;

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: debit.id },
        data: {
          categoryId: transferCategoryId,
          type: TransactionType.TRANSFER,
        },
      });
      await tx.transaction.update({
        where: { id: credit.id },
        data: {
          categoryId: transferCategoryId,
          type: TransactionType.TRANSFER,
        },
      });
      await tx.transferLink.create({
        data: {
          userId,
          debitTransactionId: debit.id,
          creditTransactionId: credit.id,
        },
      });
    });

    const updated = await this.prisma.transaction.findFirstOrThrow({
      where: { id: source.id },
      include: transactionInclude,
    });
    return this.toItem(updated as TransactionRow, 'competence');
  }

  private async clearTransferLink(
    existing: Transaction & {
      transferDebitLink: { id: string } | null;
      transferCreditLink: { id: string } | null;
    },
  ): Promise<void> {
    const linkId =
      existing.transferDebitLink?.id ?? existing.transferCreditLink?.id;
    if (!linkId) {
      return;
    }
    await this.prisma.transferLink.delete({ where: { id: linkId } });
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
    const cashDate = row.cashDate ? this.toIsoDate(row.cashDate) : null;
    const transferCounterpartId =
      row.transferDebitLink?.creditTransactionId ??
      row.transferCreditLink?.debitTransactionId ??
      null;
    return {
      id: row.id,
      description: row.description,
      amount: Number(row.amount),
      type: row.type,
      competenceDate,
      cashDate,
      displayDate:
        regime === 'competence' ? competenceDate : (cashDate ?? competenceDate),
      active: row.active,
      category: row.category
        ? {
            id: row.category.id,
            name: row.category.name,
            color: row.category.color,
            icon: row.category.icon,
            kind: row.category.kind,
            systemKey: row.category.systemKey,
          }
        : null,
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
      card: row.card
        ? {
            id: row.card.id,
            label: row.card.label,
            bank: {
              id: row.card.bank.id,
              name: row.card.bank.name,
            },
          }
        : null,
      invoiceId: row.invoiceId ?? row.invoicePaymentLink?.invoiceId ?? null,
      transferCounterpartId,
    };
  }
}
