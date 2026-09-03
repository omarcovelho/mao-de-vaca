import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ImportModule } from './modules/import/import.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './modules/reports/reports.module';
import { TransactionsModule } from './modules/transactions/transactions.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    ImportModule,
    ReportsModule,
  ],
})
export class AppModule {}
