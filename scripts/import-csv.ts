import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CsvImportService } from '../src/words/csv-import.service';
import * as path from 'path';
import * as fs from 'fs';

async function importCsvData() {
  console.log('🚀 Starting CSV import process...');
  
  try {
    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule);
    const csvImportService = app.get(CsvImportService);
    
    // CLI ARG (1st after script) or default file name
    // Accept either a file name within csv-imports/ OR an arbitrary path anywhere.
    const argPath = process.argv[2];
    const defaultFile = 'vocab_n5_complete_dataset_v2.csv';
    const inputPath = argPath ? argPath : defaultFile;

    let displayPath: string;
    let result;    
    if (fs.existsSync(inputPath) && fs.statSync(inputPath).isFile()) {
      // Absolute or relative path accessible from cwd -> read content directly
      displayPath = path.resolve(inputPath);
      console.log(`📁 Reading CSV (direct path): ${displayPath}`);
      const content = fs.readFileSync(displayPath);
      result = await csvImportService.importFromCsvContent(content);
    } else {
      // Treat as file name inside csv-imports directory consumed by service security sandbox
      displayPath = path.join('csv-imports', inputPath);
      console.log(`📁 Reading CSV (sandboxed): ${displayPath}`);
      result = await csvImportService.importFromCsv(inputPath);
    }
    
    // Display results
    console.log('\n📊 Import Results:');
    console.log('==================');
    console.log(`📝 Total words in CSV: ${result.total}`);
    console.log(`✅ Successfully imported: ${result.imported}`);
    console.log(`🔄 Duplicates skipped: ${result.duplicates}`);
    console.log(`❌ Errors encountered: ${result.errors}`);
    
    if (result.errorDetails.length > 0) {
      console.log('\n🚨 Error Details:');
      result.errorDetails.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    // Show import stats
    const stats = await csvImportService.getImportStats();
    console.log('\n📈 Database Statistics:');
    console.log('=======================');
    console.log(`📚 Total words in database: ${stats.totalWords}`);
    console.log(`🆕 Recent imports (24h): ${stats.recentImports}`);
    
    if (stats.lastImportTime) {
      console.log(`⏰ Last import: ${stats.lastImportTime.createdAt}`);
    }
    
    console.log('\n🎉 Import process completed successfully!');
    console.log(`📄 Source: ${displayPath}`);
    
    // Basic enriched field presence summary (sample first imported record if any)
    if (result.imported > 0) {
      console.log('\n🔍 Enriched Field Check (sample from DB)...');
      try {
        // Lazy dynamic import to avoid circular DI
        const dbService: any = (csvImportService as any).dbService;
        if (dbService?.db) {
          const latest = await dbService.db.query.words.findFirst({ orderBy: (w: any, { desc }: any) => [desc(w.createdAt)] });
          if (latest) {
            console.log(`   Romaji: ${latest.romaji ? '✅' : '❌'} | Topic: ${latest.topic ? '✅' : '❌'} | POS: ${latest.partOfSpeech ? '✅' : '❌'} | Vector: ${latest.vector ? '✅' : '❌'}`);
          }
        }
      } catch (e) {
        // Non-fatal
      }
    }
    
    await app.close();
    process.exit(0);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('\n💥 Import failed:', errorMessage);
    if (errorStack) {
      console.error(errorStack);
    }
    process.exit(1);
  }
}

// Run the import
importCsvData();
