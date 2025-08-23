import { Module } from '@nestjs/common';
import { WordsService } from './words.service';
import { WordsController } from './words.controller';
import { CsvImportService } from './csv-import.service';
import { DrizzleModule } from '@/db/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [WordsController],
  providers: [WordsService, CsvImportService],
  exports: [WordsService, CsvImportService],
})
export class WordsModule {}
