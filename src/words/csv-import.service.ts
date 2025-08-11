import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { parse } from 'csv-parse/sync';

interface CsvWord {
  Kanji: string;
  Hiragana: string;
  English: string;
  PronunciationURL: string;
}

interface ImportResult {
  total: number;
  imported: number;
  duplicates: number;
  errors: number;
  errorDetails: string[];
}

@Injectable()
export class CsvImportService {
  private readonly logger = new Logger(CsvImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a hash for duplicate detection
   * Uses hiragana + kanji + meaning to create a unique identifier
   */
  private generateContentHash(hiragana: string, kanji: string, meaning: string): string {
    const content = `${hiragana}|${kanji || ''}|${meaning}`.toLowerCase();
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Parse CSV file and return word data
   */
  private parseCsvFile(filePath: string): CsvWord[] {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as CsvWord[];
      return records;
    } catch (error) {
      const errorMessage = (error instanceof Error) ? error.message : String(error);
      this.logger.error(`Failed to parse CSV file: ${errorMessage}`);
      throw new Error(`Failed to parse CSV file: ${errorMessage}`);
    }
  }

  /**
   * Check if a word already exists by content hash
   */
  private async wordExists(contentHash: string): Promise<boolean> {
    const existingWord = await this.prisma.word.findUnique({
      where: { contentHash },
      select: { id: true },
    });
    return !!existingWord;
  }

  /**
   * Validate word data
   */
  private validateWordData(word: CsvWord, index: number): string[] {
    const errors: string[] = [];
    
    if (!word.Hiragana?.trim()) {
      errors.push(`Row ${index + 2}: Hiragana is required`);
    }
    
    if (!word.English?.trim()) {
      errors.push(`Row ${index + 2}: English meaning is required`);
    }
    
    if (!word.PronunciationURL?.trim()) {
      errors.push(`Row ${index + 2}: Pronunciation URL is required`);
    }

    return errors;
  }

  /**
   * Import words from CSV file with optimization and duplicate checking
   */
  async importFromCsv(filePath: string): Promise<ImportResult> {
    const result: ImportResult = {
      total: 0,
      imported: 0,
      duplicates: 0,
      errors: 0,
      errorDetails: [],
    };

    try {
      this.logger.log(`Starting CSV import from: ${filePath}`);
      
      // Parse CSV file
      const csvWords = this.parseCsvFile(filePath);
      result.total = csvWords.length;
      
      this.logger.log(`Found ${result.total} words in CSV file`);

      // Process words in batches for better performance
      const batchSize = 100;
      const batches = [];
      
      for (let i = 0; i < csvWords.length; i += batchSize) {
        batches.push(csvWords.slice(i, i + batchSize));
      }

      for (const [batchIndex, batch] of batches.entries()) {
        this.logger.log(`Processing batch ${batchIndex + 1}/${batches.length}`);
        
        const wordsToInsert = [];
        
        for (const [index, csvWord] of batch.entries()) {
          const globalIndex = batchIndex * batchSize + index;
          
          // Validate word data
          const validationErrors = this.validateWordData(csvWord, globalIndex);
          if (validationErrors.length > 0) {
            result.errors++;
            result.errorDetails.push(...validationErrors);
            continue;
          }

          // Generate content hash
          const contentHash = this.generateContentHash(
            csvWord.Hiragana,
            csvWord.Kanji,
            csvWord.English
          );

          // Check for duplicates
          const exists = await this.wordExists(contentHash);
          if (exists) {
            result.duplicates++;
            this.logger.debug(`Duplicate found: ${csvWord.Hiragana} (${csvWord.English})`);
            continue;
          }

          // Prepare word for insertion
          const wordData = {
            hiragana: csvWord.Hiragana.trim(),
            katakana: null, // CSV doesn't have katakana, set to null
            kanji: csvWord.Kanji?.trim() || null,
            pronunciation: csvWord.PronunciationURL.trim(),
            meaning: csvWord.English.trim(),
            contentHash,
          };

          wordsToInsert.push(wordData);
        }

        // Bulk insert words in this batch
        if (wordsToInsert.length > 0) {
          try {
            await this.prisma.word.createMany({
              data: wordsToInsert,
              skipDuplicates: true, // Additional safety net
            });
            result.imported += wordsToInsert.length;
            this.logger.log(`Inserted ${wordsToInsert.length} words from batch ${batchIndex + 1}`);
          } catch (error) {
            const errorMessage = (error instanceof Error) ? error.message : String(error);
            this.logger.error(`Failed to insert batch ${batchIndex + 1}: ${errorMessage}`);
            result.errors += wordsToInsert.length;
            result.errorDetails.push(`Batch ${batchIndex + 1} insertion failed: ${errorMessage}`);
          }
        }
      }

      this.logger.log(`Import completed: ${result.imported} imported, ${result.duplicates} duplicates, ${result.errors} errors`);
      return result;

    } catch (error) {
      const errorMessage = (error instanceof Error) ? error.message : String(error);
      this.logger.error(`CSV import failed: ${errorMessage}`);
      throw new Error(`CSV import failed: ${errorMessage}`);
    }
  }

  /**
   * Get import statistics
   */
  async getImportStats() {
    const totalWords = await this.prisma.word.count();
    const recentImports = await this.prisma.word.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    return {
      totalWords,
      recentImports,
      lastImportTime: await this.prisma.word.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    };
  }

  /**
   * Clear all words (use with caution!)
   */
  async clearAllWords(): Promise<number> {
    const result = await this.prisma.word.deleteMany();
    this.logger.warn(`Deleted ${result.count} words from database`);
    return result.count;
  }
}
