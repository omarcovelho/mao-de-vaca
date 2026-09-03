import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TransactionsService } from './transactions.service';
import {
  ListTransactionsQuery,
  UpdateTransactionDto,
} from './transactions.types';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListTransactionsQuery,
  ) {
    return this.transactionsService.list(user.userId, query);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(user.userId, id, body);
  }
}
