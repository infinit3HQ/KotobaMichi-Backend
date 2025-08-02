import { Module } from '@nestjs/common';
import { WordsService } from './words.service';
import { WordsController } from './words.controller';
import { CsvImportService } from './csv-import.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WordsController],
  providers: [WordsService, CsvImportService],
  exports: [WordsService, CsvImportService],
})
export class WordsModule {}
