import { Controller, Get, Query } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import {
  MonthlyEvolutionQuery,
  ReportPeriodQuery,
} from './reports.types';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query() query: ReportPeriodQuery) {
    return this.reportsService.summary(user.userId, query);
  }

  @Get('by-category')
  byCategory(
    @CurrentUser() user: AuthUser,
    @Query() query: ReportPeriodQuery,
  ) {
    return this.reportsService.byCategory(user.userId, query);
  }

  @Get('monthly-evolution')
  monthlyEvolution(
    @CurrentUser() user: AuthUser,
    @Query() query: MonthlyEvolutionQuery,
  ) {
    return this.reportsService.monthlyEvolution(user.userId, query);
  }
}
