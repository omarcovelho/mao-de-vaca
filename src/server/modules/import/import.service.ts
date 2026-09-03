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
import { TransactionsService } from '../transactions/transactions.service';
import { buildDedupKey } from './dedup-key';
import {
  CategoryMappings,
  CategoryMappingValue,
  DEFAULT_CREATED_CATEGORY_COLOR,
  DEFAULT_CREATED_CATEGORY_ICON,
  ImportModeApi,
  PreviewRow,
} from './import.types';
import type { CanonicalTransaction } from './parsers/canonical';
import { getParser, listParsers } from './parsers/parser-registry';

type UploadedCsv = {
  buffer: Buffer;
  originalname: string;
  mimetype?: string;
  size: number;
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

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
    private readonly categoriesService: CategoriesService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async getOptions(userId: string) {
    const accounts = await this.accountsService.listAccounts(userId, false);
    return {
      modes: [
        { id: 'transactions', label: 'Extrato de conta', enabled: true },
        { id: 'invoice', label: 'Fatura de cartão', enabled: false },
      ],
      parsers: listParsers(),
      accounts,
    };
  }

  async preview(
    userId: string,
    fields: {
      importMode?: string;
      accountId?: string;
      parserId?: string;
    },
    file: UploadedCsv | undefined,
  ) {
    const { account, parser, parsed } = await this.parseUpload(
      userId,
      fields,
      file,
    );
    const tree = await this.categoriesService.list(userId, false);
    const leaves = flattenLeaves(tree);
    const unknown = new Set<string>();
    const rows: PreviewRow[] = parsed.errors.map((error) => ({
      line: error.line,
      error: error.message,
    }));

    for (const row of parsed.transactions) {
      const match = leafByName(leaves, row.category);
      if (!match) {
        unknown.add(row.category.trim() || row.category);
      }
      rows.push({
        line: row.line,
        competenceDate: row.competenceDate,
        cashDate: row.cashDate,
        description: row.description,
        amount: row.amount,
        type: row.type,
        category: row.category,
        categoryId: match?.id ?? null,
      });
    }

    rows.sort((a, b) => a.line - b.line);

    return {
      accountId: account.id,
      parserId: parser.id,
      importMode: 'transactions' as const,
      rows,
      unknownCategories: [...unknown],
      summary: {
        rowCount: parsed.transactions.length + parsed.errors.length,
        validCount: parsed.transactions.length,
        errorCount: parsed.errors.length,
        unknownCategoryCount: unknown.size,
      },
    };
  }

  async confirm(
    userId: string,
    fields: {
      importMode?: string;
      accountId?: string;
      parserId?: string;
      categoryMappings?: string;
    },
    file: UploadedCsv | undefined,
  ) {
    const { account, parser, parsed, fileName } = await this.parseUpload(
      userId,
      fields,
      file,
    );
    const mappings = parseCategoryMappings(fields.categoryMappings);
    const tree = await this.categoriesService.list(userId, false);
    const leaves = flattenLeaves(tree);
    const categoryIds = new Map<string, string>();

    const uniqueCsvNames = [
      ...new Set(parsed.transactions.map((row) => row.category)),
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

    const errors = parsed.errors.map((error) => ({
      line: error.line,
      message: error.message,
    }));

    const keys = parsed.transactions.map((row) =>
      buildDedupKey(account.id, row.competenceDate, row.amount, row.description),
    );
    const existing = await this.transactionsService.existingDedupKeys(
      userId,
      keys,
    );

    const toCreate: Prisma.TransactionCreateManyInput[] = [];
    let skipped = 0;

    parsed.transactions.forEach((row, index) => {
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
      toCreate.push(this.toTransactionRow(userId, account.id, '', row, categoryId, dedupKey));
    });

    const batch = await this.prisma.importBatch.create({
      data: {
        userId,
        importMode: ImportMode.TRANSACTIONS,
        accountId: account.id,
        parserId: parser.id,
        fileName,
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
      errors,
    };
  }

  async listHistory(userId: string) {
    const batches = await this.prisma.importBatch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { account: { select: { id: true, label: true } } },
    });
    return batches.map((batch) => ({
      id: batch.id,
      importMode: batch.importMode === ImportMode.TRANSACTIONS ? 'transactions' : 'invoice',
      parserId: batch.parserId,
      fileName: batch.fileName,
      accountId: batch.accountId,
      accountLabel: batch.account?.label ?? null,
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
      parserId?: string;
    },
    file: UploadedCsv | undefined,
  ) {
    const importMode = fields.importMode as ImportModeApi | undefined;
    if (importMode && importMode !== 'transactions') {
      throw new BadRequestException(
        'Importação de fatura ainda não está disponível',
      );
    }

    if (!fields.accountId) {
      throw new BadRequestException('Conta é obrigatória');
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

    return this.parseWithAccount(userId, fields.accountId, parser, file);
  }

  private async parseWithAccount(
    userId: string,
    accountId: string,
    parser: NonNullable<ReturnType<typeof getParser>>,
    file: UploadedCsv,
  ) {
    const accounts = await this.accountsService.listAccounts(userId, false);
    const account = accounts.find((item) => item.id === accountId);
    if (!account) {
      throw new NotFoundException('Conta não encontrada ou inativa');
    }

    const parsed = parser.parse(file.buffer);
    return { account, parser, parsed, fileName: file.originalname || 'extrato.csv' };
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
    accountId: string,
    importBatchId: string,
    row: CanonicalTransaction,
    categoryId: string,
    dedupKey: string,
  ): Prisma.TransactionCreateManyInput {
    return {
      userId,
      competenceDate: new Date(`${row.competenceDate}T00:00:00.000Z`),
      cashDate: new Date(`${row.cashDate}T00:00:00.000Z`),
      description: row.description,
      amount: new Prisma.Decimal(row.amount),
      type: row.type as TransactionType,
      categoryId,
      accountId,
      importBatchId,
      dedupKey,
    };
  }
}
