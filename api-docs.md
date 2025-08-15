# KotobaMichi Backend API Documentation

**Base URL:** `http://localhost:3000/v1/`

## Authentication

All endpoints (except `/auth/*` and `/health`) require a JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

---

## 1. Authentication (`/auth`)

### Register User

- **POST** `/auth/register`
- **Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "string"
  }
  ```
- **Response:**
  ```json
  {
    "access_token": "jwt-token",
    "user": {
      "id": "string",
      "email": "string",
      "role": "USER"
    }
  }
  ```

### Register Admin

- **POST** `/auth/register/admin`
- **Auth:** `Bearer` token (admin only)
- **Body:** Same as above
- **Response:** Same as above, but `role: "ADMIN"`

### Login

- **POST** `/auth/login`
- **Body:** Same as register
- **Response:** Same as register

---

## 2. Vocabulary (`/words`)

### Get All Words (Paginated)

- **GET** `/words?page=1&limit=10`
- **Query Params:**
  - `page` (optional, default: 1)
  - `limit` (optional, default: 10)
- **Response:**
  ```json
  {
    "words": [
      {
        "id": "string",
        "hiragana": "string",
        "katakana": "string",
        "kanji": "string",
        "pronunciation": "string",
        "meaning": "string"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10
    }
  }
  ```

### Get Single Word

- **GET** `/words/:id`
- **Response:** Same as a single word object above

### Create Word

- **POST** `/words`
- **Auth:** `Bearer` token (admin only)
- **Body:**
  ```json
  {
    "hiragana": "string",
    "katakana": "string",
    "kanji": "string (optional)",
    "pronunciation": "string",
    "meaning": "string"
  }
  ```
- **Response:** Created word object

### Update Word

- **PATCH** `/words/:id`
- **Auth:** `Bearer` token (admin only)
- **Body:** Any subset of create fields
- **Response:** Updated word object

### Delete Word

- **DELETE** `/words/:id`
- **Auth:** `Bearer` token (admin only)
- **Response:**
  ```json
  { "message": "Word deleted successfully" }
  ```

### Import Words from CSV

- **POST** `/words/import/csv`
- **Auth:** `Bearer` token (admin only)
- **Body:**
  ```json
  {
    "filePath": "/absolute/path/to/vocab.csv"
  }
  ```

### Import Words from CSV (Upload)

- POST `/words/import/upload`
- Auth: `Bearer` token (admin only)
- Content-Type: `multipart/form-data`
- Form field: `file` (the CSV file)
- Response:
  ```json
  {
    "total": 562,
    "imported": 520,
    "duplicates": 42,
    "errors": 0,
    "errorDetails": []
  }
  ```

Example (curl):

```bash
curl -X POST \
  http://localhost:3000/v1/words/import/upload \
  -H "Authorization: Bearer <admin-jwt>" \
  -F "file=@vocab_n5_updated.csv;type=text/csv"
```

Example (fetch):

```ts
const form = new FormData();
form.append('file', file); // file is a File from input[type=file]

const res = await fetch('http://localhost:3000/v1/words/import/upload', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
const data = await res.json();
```
- **Response:**
  ```json
  {
    "total": 562,
    "imported": 562,
    "duplicates": 0,
    "errors": 0,
    "errorDetails": []
  }
  ```

### Get Import Statistics

- **GET** `/words/import/stats`
- **Auth:** `Bearer` token (admin only)
- **Response:**
  ```json
  {
    "totalWords": 562,
    "recentImports": 562,
    "lastImportTime": "2025-08-02T15:39:54.123Z"
  }
  ```

### Clear All Words

- **DELETE** `/words/import/clear-all`
- **Auth:** `Bearer` token (admin only)
- **Response:**
  ```json
  {
    "deletedCount": 562
  }
  ```

---

## 3. Quizzes (`/quizzes`)

### Get All Public Quizzes

- **GET** `/quizzes`
- **Response:**
  ```json
  [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "isPublic": true,
      "createdById": "string",
      "creator": { "id": "string", "email": "string", "role": "string" },
      "_count": { "quizWords": 10, "attempts": 5 }
    }
  ]
  ```

### Get My Quizzes

- **GET** `/quizzes/my-quizzes`
- **Auth:** `Bearer` token
- **Response:** Same as above, but only quizzes created by the user

### Get Quiz Details

- **GET** `/quizzes/:id`
- **Auth:** `Bearer` token
- **Response:**
  ```json
  {
    "id": "string",
    "title": "string",
    "description": "string",
    "isPublic": true,
    "createdById": "string",
    "creator": { "id": "string", "email": "string", "role": "string" },
    "quizWords": [
      {
        "id": "string",
        "wordId": "string",
        "word": {
          "id": "string",
          "hiragana": "string",
          "katakana": "string",
          "kanji": "string",
          "pronunciation": "string",
          "meaning": "string"
        }
      }
    ],
    "_count": { "attempts": 5 }
  }
  ```

### Create Quiz

- **POST** `/quizzes`
- **Auth:** `Bearer` token
- **Body:**
  ```json
  {
    "title": "string",
    "description": "string (optional)",
    "isPublic": true,
    "wordIds": ["wordId1", "wordId2"]
  }
  ```
- **Response:** Created quiz object (see above)

### Delete Quiz

- **DELETE** `/quizzes/:id`
- **Auth:** `Bearer` token (creator or admin only)
- **Response:**
  ```json
  { "message": "Quiz deleted successfully" }
  ```

### Submit Quiz

- **POST** `/quizzes/:id/submit`
- **Auth:** `Bearer` token
- **Body:**
  ```json
  {
    "answers": [
      { "wordId": "string", "answer": "string" }
    ]
  }
  ```
- **Response:**
  ```json
  {
    "attemptId": "string",
    "score": 80,
    "totalQuestions": 10,
    "results": [
      {
        "wordId": "string",
        "userAnswer": "string",
        "correctAnswers": ["string", "string"],
        "isCorrect": true,
        "word": {
          "hiragana": "string",
          "katakana": "string",
          "kanji": "string",
          "pronunciation": "string",
          "meaning": "string"
        }
      }
    ]
  }
  ```

---

## 4. Users (`/users`)

### Get User Profile

- **GET** `/users/me`
- **Auth:** `Bearer` token
- **Response:**
  ```json
  {
    "id": "string",
    "email": "string",
    "role": "USER"
  }
  ```

### Get User Quiz Attempts

- **GET** `/users/me/attempts?page=1&limit=10`
- **Auth:** `Bearer` token
- **Response:**
  ```json
  {
    "attempts": [
      {
        "id": "string",
        "quizId": "string",
        "score": 80,
        "completedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 20,
      "totalPages": 2
    }
  }
  ```

### Get User Stats

- **GET** `/users/me/stats`
- **Auth:** `Bearer` token
- **Response:**
  ```json
  {
    "totalQuizzesTaken": 5,
    "averageScore": 85,
    "wordsLearned": 100
  }
  ```

---

## 6. CSV Import System

The KotobaMichi backend includes an optimized CSV import system for bulk vocabulary loading.

### Features
- **Hash-based duplicate detection** using SHA-256 for O(1) lookups
- **Batch processing** (100 words per batch) for optimal database performance
- **Comprehensive validation** with detailed error reporting
- **Import statistics** and progress tracking
- **Skip duplicates** without failing the entire import

### CSV Format
The system expects CSV files with the following columns:
- `Kanji`: Japanese kanji characters (optional, can be empty)
- `Hiragana`: Japanese hiragana reading (required)
- `English`: English meaning (required)
- `PronunciationURL`: URL to audio pronunciation (required)

Example CSV:
```csv
Kanji,Hiragana,English,PronunciationURL
会う,あう,to meet,https://example.com/audio/meet.mp3
青,あお,blue,https://example.com/audio/blue.mp3
,あちら,there,https://example.com/audio/there.mp3
```

### CLI Usage
For convenience, you can use the provided CLI script:
```bash
pnpm run import:csv
```

This script will:
1. Read the `vocab_n5_updated.csv` file from the project root
2. Parse and validate all entries
3. Check for duplicates using content hashing
4. Import words in optimized batches
5. Provide detailed progress and statistics

### Performance
- Processes 562 words in ~4 seconds
- Handles duplicate detection in O(1) time
- Uses bulk database operations for efficiency
- Memory-efficient streaming for large files

For detailed documentation, see the [CSV Import Guide](./CSV_IMPORT_GUIDE.md).

---

## 5. Health Check

- **GET** `/health`
- **Response:**
  ```json
  { "status": "ok" }
  ```

---

## Types & Models

### User

```ts
{
  id: string;
  email: string;
  password?: string; // never returned in API
  role: 'USER' | 'ADMIN';
}
```

### Word

```ts
{
  id: string;
  hiragana: string;
  katakana: string;
  kanji?: string;
  pronunciation: string;
  meaning: string;
  contentHash: string; // SHA-256 hash for duplicate detection
}
```

### Quiz

```ts
{
  id: string;
  title: string;
  description?: string;
  isPublic: boolean;
  createdById: string;
  creator: User;
  quizWords: QuizWord[];
  _count: { attempts: number; quizWords?: number };
}
```

### QuizWord

```ts
{
  id: string;
  wordId: string;
  quizId: string;
  word: Word;
}
```

### QuizAttempt

```ts
{
  id: string;
  userId: string;
  quizId: string;
  score: number;
  completedAt: string;
}
```

---

## Error Responses

- **401 Unauthorized:** Invalid or missing JWT
- **403 Forbidden:** Insufficient permissions
- **404 Not Found:** Resource does not exist
- **409 Conflict:** Duplicate resource (e.g., email already registered)
- **400 Bad Request:** Validation error

---

**For any questions about request/response payloads, refer to the DTOs in the backend codebase or ask the backend team.**