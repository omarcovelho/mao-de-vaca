import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ImportMode, Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';
import { CategoriesService } from '../categories/categories.service';
import { CategoryResponse } from '../categories/categories.types';
import { InvoicesService } from '../invoices/invoices.service';
import { TransactionsService } from '../transactions/transactions.service';
import {
  assignOccurrences,
  buildDedupKey,
  fingerprintBase,
} from './dedup-key';
import {
  CategoryMappings,
  CategoryMappingValue,
  DEFAULT_CREATED_CATEGORY_COLOR,
  DEFAULT_CREATED_CATEGORY_ICON,
  DuplicateWarning,
  ImportModeApi,
  PreviewRow,
} from './import.types';
import type { CanonicalTransaction, ParseMode } from './parsers/canonical';
import { getParser, listParsers } from './parsers/parser-registry';

type UploadedCsv = {
  buffer: Buffer;
  originalname: string;
  mimetype?: string;
  size: number;
};

type ParsedUpload = {
  importMode: ImportModeApi;
  accountId: string | null;
  cardId: string | null;
  invoiceId: string | null;
  originId: string;
  parser: NonNullable<ReturnType<typeof getParser>>;
  parsed: ReturnType<NonNullable<ReturnType<typeof getParser>>['parse']>;
  fileName: string;
};

function flattenLeaves(nodes: CategoryResponse[]): CategoryResponse[] {
  const leaves: CategoryResponse[] = [];
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      leaves.push(...flattenLeaves(node.children));
    } else if (node.isLeaf && node.active) {
      leaves.push(node);
    }
  }
  return leaves;
}

function leafByName(
  leaves: CategoryResponse[],
  name: string,
): CategoryResponse | undefined {
  const needle = name.trim().toLowerCase();
  if (!needle) {
    return undefined;
  }
  return leaves.find((leaf) => leaf.name.toLowerCase() === needle);
}

function parseCategoryMappings(raw: string | undefined): CategoryMappings {
  if (!raw || !raw.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as CategoryMappings;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('invalid');
    }
    return parsed;
  } catch {
    throw new BadRequestException('Mapeamento de categorias inválido');
  }
}

function mappingFor(
  mappings: CategoryMappings,
  csvName: string,
): CategoryMappingValue | undefined {
  if (Object.hasOwn(mappings, csvName)) {
    return mappings[csvName];
  }
  const needle = csvName.trim().toLowerCase();
  const key = Object.keys(mappings).find((k) => k.trim().toLowerCase() === needle);
  return key === undefined ? undefined : mappings[key];
}

function parseSelectedLines(raw: string | undefined): number[] {
  if (raw === undefined || raw === null || !String(raw).trim()) {
    throw new BadRequestException('Linhas selecionadas são obrigatórias');
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      !Array.isArray(parsed) ||
      !parsed.every((item) => Number.isInteger(item) && (item as number) > 0)
    ) {
      throw new Error('invalid');
    }
    return parsed as number[];
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException('Linhas selecionadas inválidas');
  }
}

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
    private readonly categoriesService: CategoriesService,
    private readonly transactionsService: TransactionsService,
    private readonly invoicesService: InvoicesService,
  ) {}

  async getOptions(userId: string) {
    const [accounts, cards] = await Promise.all([
      this.accountsService.listAccounts(userId, false),
      this.accountsService.listCards(userId, false),
    ]);

    const invoicesByCard: Record<
      string,
      Array<{
        id: string;
        referenceMonth: string;
        dueDate: string;
        balance: number;
        status: string;
      }>
    > = {};

    await Promise.all(
      cards.map(async (card) => {
        const invoices = await this.invoicesService.listByCard(userId, card.id);
        invoicesByCard[card.id] = invoices.map((invoice) => ({
          id: invoice.id,
          referenceMonth: invoice.referenceMonth,
          dueDate: invoice.dueDate,
          balance: invoice.balance,
          status: invoice.status,
        }));
      }),
    );

    return {
      modes: [
        { id: 'transactions', label: 'Extrato de conta', enabled: true },
        { id: 'invoice', label: 'Fatura de cartão', enabled: true },
      ],
      parsers: listParsers(),
      accounts,
      cards,
      invoicesByCard,
    };
  }

  async preview(
    userId: string,
    fields: {
      importMode?: string;
      accountId?: string;
      cardId?: string;
      invoiceId?: string;
      parserId?: string;
    },
    file: UploadedCsv | undefined,
  ) {
    const upload = await this.parseUpload(userId, fields, file);
    const tree = await this.categoriesService.list(userId, false);
    const leaves = flattenLeaves(tree);
    const unknown = new Set<string>();
    const rows: PreviewRow[] = upload.parsed.errors.map((error) => ({
      line: error.line,
      error: error.message,
    }));

    const occurrences = assignOccurrences(
      upload.parsed.transactions,
      upload.originId,
    );
    const baseCounts = new Map<string, number>();
    for (const row of upload.parsed.transactions) {
      const base = fingerprintBase(
        upload.originId,
        row.competenceDate,
        row.amount,
        row.description,
      );
      baseCounts.set(base, (baseCounts.get(base) ?? 0) + 1);
    }

    const keys = upload.parsed.transactions.map((row, index) =>
      buildDedupKey(
        upload.originId,
        row.competenceDate,
        row.amount,
        row.description,
        occurrences[index],
      ),
    );
    const existing = await this.transactionsService.existingDedupKeys(
      userId,
      keys,
    );

    let duplicateWarningCount = 0;

    upload.parsed.transactions.forEach((row, index) => {
      const match = leafByName(leaves, row.category);
      if (!match) {
        unknown.add(row.category.trim() || row.category);
      }
      const base = fingerprintBase(
        upload.originId,
        row.competenceDate,
        row.amount,
        row.description,
      );
      let duplicateWarning: DuplicateWarning | null = null;
      if (existing.has(keys[index])) {
        duplicateWarning = 'existing';
      } else if ((baseCounts.get(base) ?? 0) > 1) {
        duplicateWarning = 'within_file';
      }
      if (duplicateWarning) {
        duplicateWarningCount += 1;
      }
      rows.push({
        line: row.line,
        competenceDate: row.competenceDate,
        cashDate: row.cashDate ?? undefined,
        description: row.description,
        amount: row.amount,
        type: row.type,
        category: row.category,
        categoryId: match?.id ?? null,
        duplicateWarning,
      });
    });

    rows.sort((a, b) => a.line - b.line);

    return {
      accountId: upload.accountId,
      cardId: upload.cardId,
      invoiceId: upload.invoiceId,
      parserId: upload.parser.id,
      importMode: upload.importMode,
      rows,
      unknownCategories: [...unknown],
      summary: {
        rowCount: upload.parsed.transactions.length + upload.parsed.errors.length,
        validCount: upload.parsed.transactions.length,
        errorCount: upload.parsed.errors.length,
        unknownCategoryCount: unknown.size,
        duplicateWarningCount,
      },
    };
  }

  async confirm(
    userId: string,
    fields: {
      importMode?: string;
      accountId?: string;
      cardId?: string;
      invoiceId?: string;
      parserId?: string;
      categoryMappings?: string;
      selectedLines?: string;
    },
    file: UploadedCsv | undefined,
  ) {
    const upload = await this.parseUpload(userId, fields, file);
    const selectedLines = parseSelectedLines(fields.selectedLines);
    const selectedSet = new Set(selectedLines);
    const mappings = parseCategoryMappings(fields.categoryMappings);
    const tree = await this.categoriesService.list(userId, false);
    const leaves = flattenLeaves(tree);
    const categoryIds = new Map<string, string>();

    const uniqueCsvNames = [
      ...new Set(
        upload.parsed.transactions
          .filter((row) => selectedSet.has(row.line))
          .map((row) => row.category),
      ),
    ];

    for (const csvName of uniqueCsvNames) {
      const resolved = await this.resolveCategoryId(
        userId,
        csvName,
        leaves,
        mappings,
        categoryIds,
      );
      categoryIds.set(csvName, resolved);
      const created = leaves.find((leaf) => leaf.id === resolved);
      if (!created) {
        const refreshed = await this.categoriesService.list(userId, false);
        leaves.splice(0, leaves.length, ...flattenLeaves(refreshed));
      }
    }

    const errors = upload.parsed.errors.map((error) => ({
      line: error.line,
      message: error.message,
    }));

    const occurrences = assignOccurrences(
      upload.parsed.transactions,
      upload.originId,
    );
    const keys = upload.parsed.transactions.map((row, index) =>
      buildDedupKey(
        upload.originId,
        row.competenceDate,
        row.amount,
        row.description,
        occurrences[index],
      ),
    );
    const existing = await this.transactionsService.existingDedupKeys(
      userId,
      keys,
    );

    const toCreate: Prisma.TransactionCreateManyInput[] = [];
    let skipped = 0;
    let deselected = 0;

    upload.parsed.transactions.forEach((row, index) => {
      if (!selectedSet.has(row.line)) {
        deselected += 1;
        return;
      }
      const dedupKey = keys[index];
      if (existing.has(dedupKey)) {
        skipped += 1;
        return;
      }
      existing.add(dedupKey);
      const categoryId = categoryIds.get(row.category);
      if (!categoryId) {
        errors.push({
          line: row.line,
          message: 'Categoria não resolvida',
        });
        return;
      }
      toCreate.push(
        this.toTransactionRow(userId, upload, row, categoryId, dedupKey),
      );
    });

    const batch = await this.prisma.importBatch.create({
      data: {
        userId,
        importMode:
          upload.importMode === 'invoice'
            ? ImportMode.INVOICE
            : ImportMode.TRANSACTIONS,
        accountId: upload.accountId,
        cardId: upload.cardId,
        invoiceId: upload.invoiceId,
        parserId: upload.parser.id,
        fileName: upload.fileName,
        createdCount: 0,
        skippedCount: skipped,
        errorCount: errors.length,
      },
    });

    const withBatch = toCreate.map((row) => ({
      ...row,
      importBatchId: batch.id,
    }));
    const created = await this.transactionsService.createMany(withBatch);

    await this.prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        createdCount: created,
        skippedCount: skipped,
        errorCount: errors.length,
      },
    });

    return {
      id: batch.id,
      importBatchId: batch.id,
      created,
      skipped,
      deselected,
      errors,
    };
  }

  async listHistory(userId: string) {
    const batches = await this.prisma.importBatch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        account: { select: { id: true, label: true } },
        card: { select: { id: true, label: true } },
        invoice: { select: { id: true, referenceMonth: true } },
      },
    });
    return batches.map((batch) => ({
      id: batch.id,
      importMode:
        batch.importMode === ImportMode.TRANSACTIONS ? 'transactions' : 'invoice',
      parserId: batch.parserId,
      fileName: batch.fileName,
      accountId: batch.accountId,
      accountLabel: batch.account?.label ?? null,
      cardId: batch.cardId,
      cardLabel: batch.card?.label ?? null,
      invoiceId: batch.invoiceId,
      invoiceReferenceMonth: batch.invoice
        ? batch.invoice.referenceMonth.toISOString().slice(0, 10)
        : null,
      createdCount: batch.createdCount,
      skippedCount: batch.skippedCount,
      errorCount: batch.errorCount,
      createdAt: batch.createdAt.toISOString(),
    }));
  }

  private async parseUpload(
    userId: string,
    fields: {
      importMode?: string;
      accountId?: string;
      cardId?: string;
      invoiceId?: string;
      parserId?: string;
    },
    file: UploadedCsv | undefined,
  ): Promise<ParsedUpload> {
    const importMode = (fields.importMode ?? 'transactions') as ImportModeApi;
    if (importMode !== 'transactions' && importMode !== 'invoice') {
      throw new BadRequestException('Modo de importação inválido');
    }

    if (!fields.parserId) {
      throw new BadRequestException('Parser é obrigatório');
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('Arquivo CSV é obrigatório');
    }

    const parser = getParser(fields.parserId);
    if (!parser) {
      throw new BadRequestException('Parser desconhecido');
    }

    const parseMode: ParseMode = importMode;
    const parsed = parser.parse(file.buffer, { mode: parseMode });
    const fileName = file.originalname || 'extrato.csv';

    if (importMode === 'transactions') {
      if (!fields.accountId) {
        throw new BadRequestException('Conta é obrigatória');
      }
      const accounts = await this.accountsService.listAccounts(userId, false);
      const account = accounts.find((item) => item.id === fields.accountId);
      if (!account) {
        throw new NotFoundException('Conta não encontrada ou inativa');
      }
      return {
        importMode,
        accountId: account.id,
        cardId: null,
        invoiceId: null,
        originId: account.id,
        parser,
        parsed,
        fileName,
      };
    }

    if (!fields.cardId) {
      throw new BadRequestException('Cartão é obrigatório');
    }
    if (!fields.invoiceId) {
      throw new BadRequestException('Fatura é obrigatória');
    }

    const cards = await this.accountsService.listCards(userId, false);
    const card = cards.find((item) => item.id === fields.cardId);
    if (!card) {
      throw new NotFoundException('Cartão não encontrado ou inativo');
    }

    const invoice = await this.invoicesService.getOwnedInvoice(
      userId,
      fields.invoiceId,
    );
    if (invoice.cardId !== card.id) {
      throw new BadRequestException('Fatura não pertence ao cartão selecionado');
    }

    return {
      importMode,
      accountId: null,
      cardId: card.id,
      invoiceId: invoice.id,
      originId: card.id,
      parser,
      parsed,
      fileName,
    };
  }

  private async resolveCategoryId(
    userId: string,
    csvName: string,
    leaves: CategoryResponse[],
    mappings: CategoryMappings,
    resolved: Map<string, string>,
  ): Promise<string> {
    const existing = resolved.get(csvName);
    if (existing) {
      return existing;
    }

    const match = leafByName(leaves, csvName);
    if (match) {
      return match.id;
    }

    const mapping = mappingFor(mappings, csvName);
    if (!mapping) {
      throw new BadRequestException(
        'Todas as categorias do lote precisam ser mapeadas antes de confirmar',
      );
    }

    if (typeof mapping === 'string') {
      const leaf = leaves.find((item) => item.id === mapping);
      if (!leaf) {
        throw new BadRequestException('Categoria mapeada inválida');
      }
      return leaf.id;
    }

    const name = mapping.create?.name?.trim();
    if (!name) {
      throw new BadRequestException('Nome da nova categoria é obrigatório');
    }

    const already = leafByName(leaves, name);
    if (already) {
      return already.id;
    }

    try {
      const created = await this.categoriesService.create(userId, {
        name,
        kind: 'EXPENSE',
        color: DEFAULT_CREATED_CATEGORY_COLOR,
        icon: DEFAULT_CREATED_CATEGORY_ICON,
      });
      leaves.push(created);
      return created.id;
    } catch (error) {
      if (error instanceof ConflictException) {
        const refreshed = flattenLeaves(
          await this.categoriesService.list(userId, false),
        );
        leaves.splice(0, leaves.length, ...refreshed);
        const existingLeaf = leafByName(leaves, name);
        if (existingLeaf) {
          return existingLeaf.id;
        }
        throw new BadRequestException(
          'Já existe uma categoria com este nome. Mapeie para uma folha existente.',
        );
      }
      throw error;
    }
  }

  private toTransactionRow(
    userId: string,
    upload: ParsedUpload,
    row: CanonicalTransaction,
    categoryId: string,
    dedupKey: string,
  ): Prisma.TransactionCreateManyInput {
    const cashDate =
      row.cashDate === null
        ? null
        : new Date(`${row.cashDate}T00:00:00.000Z`);

    return {
      userId,
      competenceDate: new Date(`${row.competenceDate}T00:00:00.000Z`),
      cashDate,
      description: row.description,
      amount: new Prisma.Decimal(row.amount),
      type: row.type as TransactionType,
      categoryId,
      accountId: upload.accountId,
      cardId: upload.cardId,
      invoiceId: upload.invoiceId,
      importBatchId: '',
      dedupKey,
    };
  }
}
