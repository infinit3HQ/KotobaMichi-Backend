# CSV Import System Documentation

## Overview
This system provides an optimized way to import Japanese vocabulary data from CSV files into the KotobaMichi database with the following features:

- **Hash-based duplicate detection** for fast lookups
- **Batch processing** for better performance
- **Comprehensive error handling** and validation
- **Detailed import statistics** and reporting

## Features

### 🔄 Duplicate Detection
- Uses SHA-256 hash of `hiragana + kanji + meaning` to detect duplicates
- Fast lookup using database index on `contentHash` field
- Skips duplicates instead of throwing errors

### ⚡ Performance Optimizations
- Batch processing (100 words per batch)
- Bulk database inserts using `createMany`
- Minimal database queries for duplicate checking

### 📊 Comprehensive Reporting
- Total words processed
- Successfully imported count
- Duplicates skipped count
- Errors encountered with details

## Usage

### Method 1: CLI Script (Recommended)
```bash
# Make sure you've run migrations first to add the contentHash field
pnpm run import:csv
```

### Method 2: API Endpoints
All endpoints require ADMIN role authentication.

#### Import CSV
```http
POST /words/import/csv
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "filePath": "/absolute/path/to/your/vocab_n5_updated.csv"
}
```

#### Get Import Statistics
```http
GET /words/import/stats
Authorization: Bearer <jwt-token>
```

#### Clear All Words (Use with caution!)
```http
DELETE /words/import/clear-all
Authorization: Bearer <jwt-token>
```

## CSV Format
The system expects CSV files with the following columns:
- `Kanji`: Japanese kanji characters (optional)
- `Hiragana`: Japanese hiragana reading (required)
- `English`: English meaning (required)
- `PronunciationURL`: URL to audio pronunciation (required)

Example:
```csv
Kanji,Hiragana,English,PronunciationURL
会う,あう,to meet,https://example.com/audio/meet.mp3
青,あお,blue,https://example.com/audio/blue.mp3
```

## Database Schema
The `Word` model includes an additional `contentHash` field:

```prisma
model Word {
  id            String   @id @default(cuid())
  hiragana      String
  katakana      String?
  kanji         String?
  pronunciation String
  meaning       String
  contentHash   String   @unique // Hash for fast duplicate detection
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  // Relations
  quizWords QuizWord[]

  @@map("words")
}
```

## Migration Required
Before using the import system, you need to add the `contentHash` field to your database:

```sql
-- Add the contentHash column
ALTER TABLE "words" ADD COLUMN "contentHash" TEXT;

-- Create unique index for fast lookups
CREATE UNIQUE INDEX "words_contentHash_key" ON "words"("contentHash");
```

Or use Prisma migrate:
```bash
pnpm prisma migrate dev --name add_content_hash_to_words
```

## Error Handling
The system validates:
- Required fields (hiragana, meaning, pronunciation URL)
- Data format and integrity
- Database constraints

Errors are collected and reported without stopping the entire import process.

## Performance Considerations
- **Batch Size**: Currently set to 100 words per batch (configurable)
- **Memory Usage**: Efficient streaming processing for large files
- **Database Load**: Optimized queries with minimal round trips
- **Duplicate Checking**: O(1) hash-based lookup instead of full table scans

## Example Output
```
🚀 Starting CSV import process...
📁 Reading CSV from: /path/to/vocab_n5_updated.csv

📊 Import Results:
==================
📝 Total words in CSV: 564
✅ Successfully imported: 520
🔄 Duplicates skipped: 44
❌ Errors encountered: 0

📈 Database Statistics:
=======================
📚 Total words in database: 520
🆕 Recent imports (24h): 520
⏰ Last import: 2025-08-02T10:30:45.123Z

🎉 Import process completed successfully!
```

## Troubleshooting

### Common Issues
1. **Migration not run**: Make sure to run the database migration first
2. **File not found**: Check the CSV file path in the script
3. **Permission errors**: Ensure proper file system permissions
4. **Memory issues**: For very large files, consider adjusting batch size

### Logs
The system provides detailed logging at different levels:
- INFO: General progress updates
- DEBUG: Duplicate detection details
- ERROR: Validation and database errors
- WARN: Non-critical issues

## Security
- All import endpoints require ADMIN role
- JWT authentication required
- File path validation to prevent directory traversal
- Input sanitization and validation
