import { Injectable, Logger } from '@nestjs/common';
import { words } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { DbService } from '@/db/drizzle.service';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { v7 as uuidv7 } from 'uuid';
import { parse } from 'csv-parse/sync';
import * as path from 'path';

// Matches the enriched dataset columns defined in docs/Dataset.md
interface CsvWord {
  Kanji: string;               // may be empty
  Hiragana: string;            // required
  Romaji?: string;             // optional (schema romaji)
  English: string;             // required -> schema english
  Level?: string;              // defaults to N5 if missing
  PronunciationURL: string;    // required (audio URL) -> schema pronunciationUrl
  Topic?: string;              // optional thematic topic -> schema topic
  Part_of_Speech?: string;     // grammatical category -> schema partOfSpeech
  Vector?: string;             // JSON-like string: "[0.123, ...]" -> schema vector
  vector_text?: string;        // source text used for embedding -> schema vectorText
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
  // Define the root directory for CSV imports
  private static readonly CSV_IMPORT_ROOT = path.resolve(process.cwd(), 'csv-imports');

  constructor(private readonly dbService: DbService) {}
  private get db() { return this.dbService.db; }

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
        columns: (header: string[]) => header.map(h => this.normalizeHeader(h)),
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
   * Parse CSV content (string or Buffer) and return word data
   */
  private parseCsvContent(content: string | Buffer): CsvWord[] {
    try {
      const records = parse(content, {
        columns: (header: string[]) => header.map(h => this.normalizeHeader(h)),
        skip_empty_lines: true,
        trim: true,
      }) as CsvWord[];
      return records;
    } catch (error) {
      const errorMessage = (error instanceof Error) ? error.message : String(error);
      this.logger.error(`Failed to parse CSV content: ${errorMessage}`);
      throw new Error(`Failed to parse CSV content: ${errorMessage}`);
    }
  }

  /**
   * Normalize a CSV header name to the canonical field expected by CsvWord.
   * Handles BOM, case differences, underscores/spaces variants.
   */
  private normalizeHeader(raw: string): string {
    const cleaned = raw.replace(/^\uFEFF/, '').trim();
    const key = cleaned.toLowerCase().replace(/\s+/g, '_');
    // Map of normalized -> canonical header names
    const map: Record<string, string> = {
      kanji: 'Kanji',
      hiragana: 'Hiragana',
      romaji: 'Romaji',
      english: 'English',
      level: 'Level',
      pronunciationurl: 'PronunciationURL',
      pronunciation_url: 'PronunciationURL',
      topic: 'Topic',
      part_of_speech: 'Part_of_Speech',
      partofspeech: 'Part_of_Speech',
      vector: 'Vector',
      vector_text: 'vector_text',
      vectortext: 'vector_text',
    };
    const canonical = map[key] || cleaned; // fallback to original if unknown
    if (cleaned !== canonical) {
      this.logger.debug(`Header normalized: '${cleaned}' -> '${canonical}'`);
    }
    return canonical;
  }

  /**
   * Check if a word already exists by content hash
   */
  private async wordExists(contentHash: string): Promise<boolean> {
  const existing = await this.db.query.words.findFirst({ where: eq(words.contentHash, contentHash), columns: { id: true } });
  return !!existing;
  }

  /**
   * Validate word data
   */
  private validateWordData(word: CsvWord, index: number): string[] {
    const errors: string[] = [];
    const row = index + 2; // account for header row

    if (!word.Hiragana?.trim()) {
      errors.push(`Row ${row}: Hiragana is required`);
    }
    if (!word.English?.trim()) {
      errors.push(`Row ${row}: English meaning is required`);
    }
    if (!word.PronunciationURL?.trim()) {
      errors.push(`Row ${row}: Pronunciation URL is required`);
    }
    // Romaji expected in enriched dataset but allow import if missing (will log)
    if (!word.Romaji?.trim()) {
      this.logger.warn(`Row ${row}: Romaji missing; continuing with fallback`);
    }
    // Optional: basic vector sanity (length & numeric) if provided
    if (word.Vector) {
      const parsed = this.safeParseVector(word.Vector);
      if (parsed && parsed.length !== 768) {
        errors.push(`Row ${row}: Vector length ${parsed.length} != 768`);
      }
    }
    return errors;
  }

  /**
   * Parse vector string -> number[] (expects JSON-like array string)
   * Returns undefined on failure (caller decides how to handle)
   */
  private safeParseVector(vectorStr?: string): number[] | undefined {
    if (!vectorStr) return undefined;
    const trimmed = vectorStr.trim();
    if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return undefined;
    try {
      // Use JSON.parse; dataset format is valid JSON array
      const arr = JSON.parse(trimmed);
      if (!Array.isArray(arr)) return undefined;
      // Convert each element to number (filter out NaN)
      const nums = arr.map((v: any) => Number(v)).filter((n: number) => Number.isFinite(n));
      if (nums.length === 0) return undefined;
      return nums;
    } catch (e) {
      this.logger.warn(`Vector parse failed: ${(e instanceof Error) ? e.message : String(e)}`);
      return undefined;
    }
  }

  /**
   * Core processor for parsed CSV records
   */
  private async processCsvRecords(csvWords: CsvWord[]): Promise<ImportResult> {
    const result: ImportResult = {
      total: csvWords.length,
      imported: 0,
      duplicates: 0,
      errors: 0,
      errorDetails: [],
    };

    // Process words in batches for better performance
    const batchSize = 100;
    const batches: CsvWord[][] = [];

    for (let i = 0; i < csvWords.length; i += batchSize) {
      batches.push(csvWords.slice(i, i + batchSize));
    }

    for (const [batchIndex, batch] of batches.entries()) {
      this.logger.log(`Processing batch ${batchIndex + 1}/${batches.length}`);

      const wordsToInsert: Array<{
        hiragana: string;
        kanji?: string;
        romaji?: string;
        pronunciationUrl: string; // audio URL
        english: string;
        level: string;
        topic?: string;
        partOfSpeech?: string;
        vector?: number[];
        vectorText?: string;
        contentHash: string;
      }> = [];

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
          csvWord.English,
        );

        // Check for duplicates
        const exists = await this.wordExists(contentHash);
        if (exists) {
          result.duplicates++;
          this.logger.debug(`Duplicate found: ${csvWord.Hiragana} (${csvWord.English})`);
          continue;
        }

        // Prepare word for insertion
        // Parse vector if provided
        const parsedVector = this.safeParseVector(csvWord.Vector);

        const wordData: typeof wordsToInsert[number] = {
          hiragana: csvWord.Hiragana.trim(),
          pronunciationUrl: csvWord.PronunciationURL.trim(),
          english: csvWord.English.trim(),
          level: csvWord.Level?.trim() || 'N5',
          contentHash,
        };
        const kanji = csvWord.Kanji?.trim();
        if (kanji) wordData.kanji = kanji;
        const romaji = csvWord.Romaji?.trim();
        if (romaji) wordData.romaji = romaji;
        const topic = csvWord.Topic?.trim();
        if (topic) wordData.topic = topic;
        const pos = csvWord.Part_of_Speech?.trim();
        if (pos) wordData.partOfSpeech = pos;
        if (parsedVector && parsedVector.length === 768) wordData.vector = parsedVector;
        const vectorText = csvWord.vector_text?.trim();
        if (vectorText) wordData.vectorText = vectorText;

        wordsToInsert.push(wordData);
      }

      // Bulk insert words in this batch
      if (wordsToInsert.length > 0) {
        try {
          // Drizzle lacks native createMany skipDuplicates; fallback to sequential inserts with ON CONFLICT DO NOTHING raw
          for (const w of wordsToInsert) {
            await this.db.insert(words).values({
              id: uuidv7(),
              hiragana: w.hiragana,
              kanji: w.kanji,
              romaji: w.romaji,
              english: w.english,
              level: w.level,
              pronunciationUrl: w.pronunciationUrl,
              topic: w.topic,
              partOfSpeech: w.partOfSpeech,
              vector: w.vector,
              vectorText: w.vectorText,
              contentHash: w.contentHash,
            }).onConflictDoNothing();
          }
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
  }

  /**
   * Import words from CSV file path
   */
  async importFromCsv(filePath: string): Promise<ImportResult> {
    try {
      this.logger.log(`Starting CSV import from: ${filePath}`);
      // Validate and resolve the file path
      const root = CsvImportService.CSV_IMPORT_ROOT;
      const resolvedPath = path.resolve(root, filePath);
      if (!resolvedPath.startsWith(root + path.sep)) {
        this.logger.error(`Attempted access to file outside import root: ${resolvedPath}`);
        throw new Error('Invalid file path: Access denied.');
      }
      const csvWords = this.parseCsvFile(resolvedPath);
      this.logger.log(`Found ${csvWords.length} words in CSV file`);
      return await this.processCsvRecords(csvWords);
    } catch (error) {
      const errorMessage = (error instanceof Error) ? error.message : String(error);
      this.logger.error(`CSV import failed: ${errorMessage}`);
      throw new Error(`CSV import failed: ${errorMessage}`);
    }
  }

  /**
   * Import words from CSV content (uploaded file)
   */
  async importFromCsvContent(content: string | Buffer): Promise<ImportResult> {
    try {
      this.logger.log('Starting CSV import from uploaded content');
      const csvWords = this.parseCsvContent(content);
      this.logger.log(`Found ${csvWords.length} words in uploaded CSV`);
      return await this.processCsvRecords(csvWords);
    } catch (error) {
      const errorMessage = (error instanceof Error) ? error.message : String(error);
      this.logger.error(`CSV upload import failed: ${errorMessage}`);
      throw new Error(`CSV upload import failed: ${errorMessage}`);
    }
  }

  /**
   * Get import statistics
   */
  async getImportStats() {
  const [totalRow] = await this.db.select({ value: sql<number>`count(*)` }).from(words);
  const [recentRow] = await this.db.select({ value: sql<number>`count(*)` }).from(words).where(sql`created_at >= now() - interval '24 hours'`);

    return {
  totalWords: Number(totalRow?.value || 0),
  recentImports: Number(recentRow?.value || 0),
      lastImportTime: await this.db.query.words.findFirst({ orderBy: (w,{ desc }) => [desc(w.createdAt)], columns: { createdAt: true } }),
    };
  }

  /**
   * Clear all words (use with caution!)
   */
  async clearAllWords(): Promise<number> {
  const deleted = await this.db.delete(words).returning({ id: words.id });
  this.logger.warn(`Deleted ${deleted.length} words from database`);
  return deleted.length;
  }
}
