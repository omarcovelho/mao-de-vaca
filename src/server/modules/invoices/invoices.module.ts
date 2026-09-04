import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { InvoicesController, InvoiceDetailController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [CategoriesModule],
  controllers: [InvoicesController, InvoiceDetailController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
