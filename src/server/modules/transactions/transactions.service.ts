import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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
}
