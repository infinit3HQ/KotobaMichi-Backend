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