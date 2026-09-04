import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InvoicesService } from './invoices.service';
import {
  CreateInvoiceDto,
  LinkInvoicePaymentsDto,
  UpdateInvoiceDto,
} from './invoices.types';

@Controller('cards/:cardId/invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('cardId') cardId: string,
  ) {
    return this.invoicesService.listByCard(user.userId, cardId);
  }

  @Post()
  @HttpCode(201)
  create(
    @CurrentUser() user: AuthUser,
    @Param('cardId') cardId: string,
    @Body() body: CreateInvoiceDto,
  ) {
    return this.invoicesService.create(user.userId, cardId, body);
  }
}

@Controller('invoices')
export class InvoiceDetailController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invoicesService.getById(user.userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(user.userId, id, body);
  }

  @Post(':id/payments')
  @HttpCode(200)
  linkPayments(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: LinkInvoicePaymentsDto,
  ) {
    return this.invoicesService.linkPayments(user.userId, id, body);
  }
}
