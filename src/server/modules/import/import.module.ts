import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { CategoriesModule } from '../categories/categories.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { ImportsController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [AccountsModule, CategoriesModule, TransactionsModule],
  controllers: [ImportsController],
  providers: [ImportService],
})
export class ImportModule {}
