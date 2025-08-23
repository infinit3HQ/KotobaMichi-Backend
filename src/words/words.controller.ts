import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WordsService } from './words.service';
import { CreateWordDto } from './dto/create-word.dto';
import { UpdateWordDto } from './dto/update-word.dto';
import { CsvImportService } from './csv-import.service';
import { BulkImportResultDto, ImportStatsDto } from './dto/bulk-import.dto';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
// Replaced Prisma UserRole enum with local literal to remove Prisma dependency
const ADMIN_ROLE = 'ADMIN';

@Controller('words')
export class WordsController {
  constructor(
    private readonly wordsService: WordsService,
    private readonly csvImportService: CsvImportService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ADMIN_ROLE)
  create(@Body() createWordDto: CreateWordDto) {
    return this.wordsService.create(createWordDto);
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    
    return this.wordsService.findAll(pageNum, limitNum);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.wordsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ADMIN_ROLE)
  update(@Param('id') id: string, @Body() updateWordDto: UpdateWordDto) {
    return this.wordsService.update(id, updateWordDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ADMIN_ROLE)
  remove(@Param('id') id: string) {
    return this.wordsService.remove(id);
  }

  // CSV Import endpoints
  @Post('import/csv')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ADMIN_ROLE)
  async importFromCsv(@Body('filePath') filePath: string): Promise<BulkImportResultDto> {
    return this.csvImportService.importFromCsv(filePath);
  }

  // New: CSV upload endpoint (multipart/form-data)
  @Post('import/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ADMIN_ROLE)
  @UseInterceptors(FileInterceptor('file'))
  async importFromUpload(@UploadedFile() file: any): Promise<BulkImportResultDto> {
    if (!file) {
      throw new Error('CSV file is required (field name: file)');
    }
    // file.buffer is a Buffer when using memory storage
    return this.csvImportService.importFromCsvContent(file.buffer);
  }

  @Get('import/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ADMIN_ROLE)
  async getImportStats(): Promise<ImportStatsDto> {
    const stats = await this.csvImportService.getImportStats();
    return {
      ...stats,
      lastImportTime: stats.lastImportTime ? stats.lastImportTime.createdAt : null,
    };
  }

  @Delete('import/clear-all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ADMIN_ROLE)
  async clearAllWords(): Promise<{ deletedCount: number }> {
    const deletedCount = await this.csvImportService.clearAllWords();
    return { deletedCount };
  }
}
