import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './invoices.types';

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
}
