import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccountsService } from './accounts.service';
import {
  CreateBankDto,
  CreateOriginDto,
  UpdateOriginDto,
} from './accounts.types';

@Controller()
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('setup/status')
  getSetupStatus(@CurrentUser() user: AuthUser) {
    return this.accountsService.getSetupStatus(user.userId);
  }

  @Get('banks')
  listBanks(@CurrentUser() user: AuthUser) {
    return this.accountsService.listBanks(user.userId);
  }

  @Post('banks')
  @HttpCode(201)
  createBank(@CurrentUser() user: AuthUser, @Body() body: CreateBankDto) {
    return this.accountsService.createBank(user.userId, body);
  }

  @Get('accounts')
  listAccounts(
    @CurrentUser() user: AuthUser,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.accountsService.listAccounts(
      user.userId,
      includeInactive === 'true',
    );
  }

  @Post('accounts')
  @HttpCode(201)
  createAccount(@CurrentUser() user: AuthUser, @Body() body: CreateOriginDto) {
    return this.accountsService.createAccount(user.userId, body);
  }

  @Patch('accounts/:id')
  updateAccount(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateOriginDto,
  ) {
    return this.accountsService.updateAccount(user.userId, id, body);
  }

  @Get('cards')
  listCards(
    @CurrentUser() user: AuthUser,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.accountsService.listCards(
      user.userId,
      includeInactive === 'true',
    );
  }

  @Post('cards')
  @HttpCode(201)
  createCard(@CurrentUser() user: AuthUser, @Body() body: CreateOriginDto) {
    return this.accountsService.createCard(user.userId, body);
  }

  @Patch('cards/:id')
  updateCard(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateOriginDto,
  ) {
    return this.accountsService.updateCard(user.userId, id, body);
  }
}
