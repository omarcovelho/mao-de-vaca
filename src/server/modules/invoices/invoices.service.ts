import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateInvoiceDto,
  InvoiceDetailResponse,
  InvoiceResponse,
  InvoiceStatusApi,
  InvoiceTransactionItem,
} from './invoices.types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

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
      },
    });

    return invoices.map((invoice) => this.toResponse(invoice));
  }

  async getById(
    userId: string,
    invoiceId: string,
  ): Promise<InvoiceDetailResponse> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
      include: {
        card: {
          select: {
            id: true,
            label: true,
            bank: { select: { id: true, name: true } },
          },
        },
        transactions: {
          where: { active: true },
          orderBy: [{ competenceDate: 'desc' }, { createdAt: 'desc' }],
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
      },
    });

    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada');
    }

    const base = this.toResponse({
      id: invoice.id,
      cardId: invoice.cardId,
      referenceMonth: invoice.referenceMonth,
      dueDate: invoice.dueDate,
      createdAt: invoice.createdAt,
      transactions: invoice.transactions.map((tx) => ({ amount: tx.amount })),
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
    };
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
        },
      });
      return this.toResponse(invoice);
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
    transactions: Array<{ amount: Prisma.Decimal }>;
  }): InvoiceResponse {
    const balance = roundMoney(
      invoice.transactions.reduce((sum, row) => sum + Number(row.amount), 0),
    );
    return {
      id: invoice.id,
      cardId: invoice.cardId,
      referenceMonth: invoice.referenceMonth.toISOString().slice(0, 10),
      dueDate: invoice.dueDate.toISOString().slice(0, 10),
      balance,
      status: this.statusFromBalance(balance),
      createdAt: invoice.createdAt.toISOString(),
    };
  }

  private statusFromBalance(balance: number): InvoiceStatusApi {
    if (balance < 0) {
      return 'open';
    }
    return 'paid';
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
