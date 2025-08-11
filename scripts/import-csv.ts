import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CsvImportService } from '../src/words/csv-import.service';
import * as path from 'path';

async function importCsvData() {
  console.log('🚀 Starting CSV import process...');
  
  try {
    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule);
    const csvImportService = app.get(CsvImportService);
    
    // Path to your CSV file (adjust if needed)
    const csvFilePath = path.join(__dirname, '..', 'vocab_n5_updated.csv');
    console.log(`📁 Reading CSV from: ${csvFilePath}`);
    
    // Import the data
    const result = await csvImportService.importFromCsv(csvFilePath);
    
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
