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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.types';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.categoriesService.list(
      user.userId,
      includeInactive === 'true',
    );
  }

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: AuthUser, @Body() body: CreateCategoryDto) {
    return this.categoriesService.create(user.userId, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(user.userId, id, body);
  }
}
