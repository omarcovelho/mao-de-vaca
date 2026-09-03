import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ImportService } from './import.service';
import { MAX_IMPORT_FILE_BYTES } from './import.types';

type UploadedCsvFile = {
  buffer: Buffer;
  originalname: string;
  mimetype?: string;
  size: number;
};

const uploadInterceptor = FileInterceptor('file', {
  limits: { fileSize: MAX_IMPORT_FILE_BYTES },
});

@Controller('imports')
export class ImportsController {
  constructor(private readonly importService: ImportService) {}

  @Get('options')
  getOptions(@CurrentUser() user: AuthUser) {
    return this.importService.getOptions(user.userId);
  }

  @Get()
  listHistory(@CurrentUser() user: AuthUser) {
    return this.importService.listHistory(user.userId);
  }

  @Post('preview')
  @HttpCode(200)
  @UseInterceptors(uploadInterceptor)
  preview(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedCsvFile | undefined,
    @Body()
    body: {
      importMode?: string;
      accountId?: string;
      cardId?: string;
      invoiceId?: string;
      parserId?: string;
    },
  ) {
    return this.importService.preview(user.userId, body, file);
  }

  @Post('confirm')
  @HttpCode(200)
  @UseInterceptors(uploadInterceptor)
  confirm(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedCsvFile | undefined,
    @Body()
    body: {
      importMode?: string;
      accountId?: string;
      cardId?: string;
      invoiceId?: string;
      parserId?: string;
      categoryMappings?: string;
    },
  ) {
    return this.importService.confirm(user.userId, body, file);
  }
}
