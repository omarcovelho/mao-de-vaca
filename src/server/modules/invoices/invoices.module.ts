import { Module } from '@nestjs/common';
import { InvoicesController, InvoiceDetailController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  controllers: [InvoicesController, InvoiceDetailController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
