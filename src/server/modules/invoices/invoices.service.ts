import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateInvoiceDto,
  InvoiceDetailResponse,
  InvoicePaymentItem,
  InvoiceResponse,
  InvoiceStatusApi,
  InvoiceTransactionItem,
  LinkInvoicePaymentsDto,
} from './invoices.types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

type AmountRow = { amount: Prisma.Decimal };

const invoiceDetailInclude = {
  card: {
    select: {
      id: true,
      label: true,
      bank: { select: { id: true, name: true } },
    },
  },
  transactions: {
    where: { active: true },
    orderBy: [{ competenceDate: 'desc' as const }, { createdAt: 'desc' as const }],
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
    },
  },
  paymentLinks: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      transaction: {
        include: {
          account: {
            select: {
              id: true,
              label: true,
              bank: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.InvoiceInclude;

type InvoiceDetailRecord = Prisma.InvoiceGetPayload<{
  include: typeof invoiceDetailInclude;
}>;

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async listByCard(userId: string, cardId: string): Promise<InvoiceResponse[]> {
    await this.assertOwnedCard(userId, cardId);

    const invoices = await this.prisma.invoice.findMany({
      where: { userId, cardId },
      orderBy: { referenceMonth: 'desc' },
      include: {
        transactions: {
          where: { active: true },
          select: { amount: true },
        },
        paymentLinks: {
          include: {
            transaction: { select: { amount: true, active: true } },
          },
        },
      },
    });

    return invoices.map((invoice) =>
      this.toResponse({
        id: invoice.id,
        cardId: invoice.cardId,
        referenceMonth: invoice.referenceMonth,
        dueDate: invoice.dueDate,
        createdAt: invoice.createdAt,
        transactions: invoice.transactions,
        paymentAmounts: invoice.paymentLinks
          .filter((link) => link.transaction.active)
          .map((link) => ({ amount: link.transaction.amount })),
      }),
    );
  }

  async getById(
    userId: string,
    invoiceId: string,
  ): Promise<InvoiceDetailResponse> {
    const invoice = await this.loadInvoiceDetail(userId, invoiceId);
    return this.toDetailResponse(invoice);
  }

  async create(
    userId: string,
    cardId: string,
    dto: CreateInvoiceDto,
  ): Promise<InvoiceResponse> {
    await this.assertOwnedCard(userId, cardId);

    const referenceMonth = this.parseReferenceMonth(dto.referenceMonth);
    const dueDate = this.parseDueDate(dto.dueDate);

    try {
      const invoice = await this.prisma.invoice.create({
        data: {
          userId,
          cardId,
          referenceMonth,
          dueDate,
        },
        include: {
          transactions: {
            where: { active: true },
            select: { amount: true },
          },
          paymentLinks: {
            include: {
              transaction: { select: { amount: true, active: true } },
            },
          },
        },
      });
      return this.toResponse({
        id: invoice.id,
        cardId: invoice.cardId,
        referenceMonth: invoice.referenceMonth,
        dueDate: invoice.dueDate,
        createdAt: invoice.createdAt,
        transactions: invoice.transactions,
        paymentAmounts: invoice.paymentLinks
          .filter((link) => link.transaction.active)
          .map((link) => ({ amount: link.transaction.amount })),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Já existe uma fatura para este cartão no mês de referência',
        );
      }
      throw error;
    }
  }

  async linkPayments(
    userId: string,
    invoiceId: string,
    dto: LinkInvoicePaymentsDto,
  ): Promise<InvoiceDetailResponse> {
    const transactionIds = Array.isArray(dto.transactionIds)
      ? [...new Set(dto.transactionIds.map((id) => id?.trim()).filter(Boolean))]
      : [];

    if (transactionIds.length === 0) {
      throw new BadRequestException('Informe ao menos um lançamento');
    }

    await this.getOwnedInvoice(userId, invoiceId);

    const payments = await this.prisma.transaction.findMany({
      where: { id: { in: transactionIds }, userId },
      include: { invoicePaymentLink: true },
    });

    if (payments.length !== transactionIds.length) {
      throw new BadRequestException('Lançamento de pagamento não encontrado');
    }

    for (const payment of payments) {
      if (!payment.active) {
        throw new BadRequestException('Lançamento inativo não pode ser vinculado');
      }
      if (!payment.accountId || payment.cardId) {
        throw new BadRequestException(
          'Pagamento deve ser um débito de conta cadastrada',
        );
      }
      if (Number(payment.amount) >= 0) {
        throw new BadRequestException(
          'Pagamento deve ser um débito (valor negativo)',
        );
      }
      if (payment.invoicePaymentLink) {
        throw new BadRequestException(
          'Lançamento já está vinculado a uma fatura',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const payment of payments) {
        await tx.invoicePaymentLink.create({
          data: {
            userId,
            invoiceId,
            transactionId: payment.id,
          },
        });
        await tx.transaction.update({
          where: { id: payment.id },
          data: { type: TransactionType.INVOICE_PAYMENT },
        });
      }

      await this.recomputePurchaseCashDates(tx, userId, invoiceId);
    });

    const detail = await this.loadInvoiceDetail(userId, invoiceId);
    return this.toDetailResponse(detail);
  }

  async getOwnedInvoice(
    userId: string,
    invoiceId: string,
  ): Promise<{ id: string; cardId: string }> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
      select: { id: true, cardId: true },
    });
    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada');
    }
    return invoice;
  }

  private async recomputePurchaseCashDates(
    tx: Prisma.TransactionClient,
    userId: string,
    invoiceId: string,
  ): Promise<void> {
    const links = await tx.invoicePaymentLink.findMany({
      where: { userId, invoiceId },
      include: {
        transaction: {
          select: {
            active: true,
            cashDate: true,
            competenceDate: true,
          },
        },
      },
    });

    const paymentDates = links
      .filter((link) => link.transaction.active)
      .map(
        (link) =>
          link.transaction.cashDate ?? link.transaction.competenceDate,
      );

    if (paymentDates.length === 0) {
      return;
    }

    const latest = paymentDates.reduce((max, date) =>
      date.getTime() > max.getTime() ? date : max,
    );

    await tx.transaction.updateMany({
      where: {
        userId,
        invoiceId,
        active: true,
        cardId: { not: null },
      },
      data: { cashDate: latest },
    });
  }

  private async loadInvoiceDetail(
    userId: string,
    invoiceId: string,
  ): Promise<InvoiceDetailRecord> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
      include: invoiceDetailInclude,
    });

    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada');
    }

    return invoice;
  }

  private toDetailResponse(invoice: InvoiceDetailRecord): InvoiceDetailResponse {
    const activePayments = invoice.paymentLinks.filter(
      (link) => link.transaction.active,
    );

    const base = this.toResponse({
      id: invoice.id,
      cardId: invoice.cardId,
      referenceMonth: invoice.referenceMonth,
      dueDate: invoice.dueDate,
      createdAt: invoice.createdAt,
      transactions: invoice.transactions.map((tx) => ({ amount: tx.amount })),
      paymentAmounts: activePayments.map((link) => ({
        amount: link.transaction.amount,
      })),
    });

    return {
      ...base,
      card: {
        id: invoice.card.id,
        label: invoice.card.label,
        bank: {
          id: invoice.card.bank.id,
          name: invoice.card.bank.name,
        },
      },
      transactions: invoice.transactions.map(
        (tx): InvoiceTransactionItem => ({
          id: tx.id,
          description: tx.description,
          amount: Number(tx.amount),
          type: tx.type,
          competenceDate: tx.competenceDate.toISOString().slice(0, 10),
          cashDate: tx.cashDate ? tx.cashDate.toISOString().slice(0, 10) : null,
          active: tx.active,
          category: {
            id: tx.category.id,
            name: tx.category.name,
            color: tx.category.color,
            icon: tx.category.icon,
            kind: tx.category.kind,
          },
        }),
      ),
      payments: activePayments.map((link): InvoicePaymentItem => {
        const tx = link.transaction;
        if (!tx.account) {
          throw new BadRequestException('Pagamento sem conta vinculada');
        }
        return {
          id: tx.id,
          description: tx.description,
          amount: Number(tx.amount),
          type: 'INVOICE_PAYMENT',
          competenceDate: tx.competenceDate.toISOString().slice(0, 10),
          cashDate: tx.cashDate ? tx.cashDate.toISOString().slice(0, 10) : null,
          account: {
            id: tx.account.id,
            label: tx.account.label,
            bank: {
              id: tx.account.bank.id,
              name: tx.account.bank.name,
            },
          },
        };
      }),
    };
  }

  private async assertOwnedCard(userId: string, cardId: string): Promise<void> {
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, userId },
      select: { id: true },
    });
    if (!card) {
      throw new NotFoundException('Cartão não encontrado');
    }
  }

  private parseReferenceMonth(raw: string | undefined): Date {
    if (!raw?.trim()) {
      throw new BadRequestException('Mês de referência é obrigatório');
    }
    const value = raw.trim();
    if (MONTH_RE.test(value)) {
      return new Date(`${value}-01T00:00:00.000Z`);
    }
    if (DATE_RE.test(value)) {
      const day = value.slice(8, 10);
      if (day !== '01') {
        throw new BadRequestException(
          'Mês de referência deve ser o primeiro dia do mês (YYYY-MM-01) ou YYYY-MM',
        );
      }
      return new Date(`${value}T00:00:00.000Z`);
    }
    throw new BadRequestException(
      'Mês de referência inválido (use YYYY-MM ou YYYY-MM-01)',
    );
  }

  private parseDueDate(raw: string | undefined): Date {
    if (!raw?.trim() || !DATE_RE.test(raw.trim())) {
      throw new BadRequestException('Data de vencimento inválida (YYYY-MM-DD)');
    }
    return new Date(`${raw.trim()}T00:00:00.000Z`);
  }

  private toResponse(invoice: {
    id: string;
    cardId: string;
    referenceMonth: Date;
    dueDate: Date;
    createdAt: Date;
    transactions: AmountRow[];
    paymentAmounts: AmountRow[];
  }): InvoiceResponse {
    const purchasesSum = invoice.transactions.reduce(
      (sum, row) => sum + Number(row.amount),
      0,
    );
    const paymentsSum = invoice.paymentAmounts.reduce(
      (sum, row) => sum + Number(row.amount),
      0,
    );
    const balance = roundMoney(purchasesSum - paymentsSum);
    return {
      id: invoice.id,
      cardId: invoice.cardId,
      referenceMonth: invoice.referenceMonth.toISOString().slice(0, 10),
      dueDate: invoice.dueDate.toISOString().slice(0, 10),
      balance,
      status: this.statusFrom(balance, invoice.paymentAmounts.length > 0),
      createdAt: invoice.createdAt.toISOString(),
    };
  }

  private statusFrom(
    balance: number,
    hasPayments: boolean,
  ): InvoiceStatusApi {
    if (balance >= 0) {
      return 'paid';
    }
    if (hasPayments) {
      return 'partial';
    }
    return 'open';
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
