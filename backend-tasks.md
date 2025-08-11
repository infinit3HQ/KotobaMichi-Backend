# Project: JLPT N5 Vocabulary & Quiz App - Backend Tasks

## 1. Core Setup & Configuration
- [x] Initialize NestJS project.
- [x] Integrate Prisma ORM.
- [x] Define database schema in `schema.prisma` for:
  - `User` (id, email, password, role: `USER` | `ADMIN`)
  - `Word` (id, hiragana, katakana, kanji, pronunciation, meaning)
  - `Quiz` (id, title, description, createdById -> `User`, isPublic)
  - `QuizWord` (join table for many-to-many between `Quiz` and `Word`)
  - `QuizAttempt` (id, userId, quizId, score, completedAt)
- [x] Set up environment variables (`.env`) for database URL, JWT secret, and port.
- [x] Configure `main.ts` with global pipes for validation (`ValidationPipe`).

---

## 2. Authentication & Authorization Module (`/auth`)
- [x] Create `AuthModule`.
- [x] **DTOs:** `RegisterUserDto`, `LoginUserDto`.
- [x] **Controller:**
  - `POST /auth/register`: Handle user registration (hash password with bcrypt).
  - `POST /auth/login`: Validate credentials and return a JWT.
- [x] **Service:** Implement registration and login logic.
- [x] **JWT Strategy:** Implement `JwtStrategy` for Passport.js.
- [x] **Guards:**
  - `JwtAuthGuard`: Protect routes requiring authentication.
  - `RolesGuard`: Protect routes based on user role (`ADMIN` vs. `USER`).

---

## 3. Vocabulary Module (`/words`)
- [x] Create `WordsModule`.
- [x] **DTOs:** `CreateWordDto`, `UpdateWordDto`.
- [x] **Controller:**
  - `POST /words`: Create a new word (Admin only).
  - `GET /words`: Get a paginated list of all words.
  - `GET /words/:id`: Get a single word by ID.
  - `PATCH /words/:id`: Update a word (Admin only).
  - `DELETE /words/:id`: Delete a word (Admin only).
- [x] **Service:** Implement CRUD logic using Prisma Client.

---

## 4. Quiz Module (`/quizzes`)
- [x] Create `QuizzesModule`.
- [x] **DTOs:** `CreateQuizDto` (title, description, isPublic, wordIds: `string[]`), `SubmitQuizDto` (answers: `{ wordId: string, answer: string }[]`).
- [x] **Controller:**
  - `POST /quizzes`: Create a new quiz (user-created or admin-created general quiz).
  - `GET /quizzes`: Get all public (general) quizzes.
  - `GET /quizzes/my-quizzes`: Get all quizzes created by the authenticated user.
  - `GET /quizzes/:id`: Get quiz details and its associated words.
  - `DELETE /quizzes/:id`: Delete a quiz (only by creator or admin).
  - `POST /quizzes/:id/submit`: Submit answers for a quiz attempt and get results.
- [x] **Service:**
  - Implement quiz creation logic, linking words via the `QuizWord` join table.
  - Implement quiz submission logic to calculate score and save the attempt.

---

## 5. User Module (`/users`)
- [x] Create `UsersModule`.
- [x] **Controller:**
  - `GET /users/me`: Get the authenticated user's profile.
  - `GET /users/me/attempts`: Get the authenticated user's quiz attempt history.
  - `GET /users/me/stats`: Get the authenticated user's statistics (average score, total attempts, etc.).
- [x] **Service:** Implement logic to fetch user data and related history from the database.

---

## 6. Testing & Deployment
- [x] Write unit tests for services (e.g., auth logic, quiz scoring).
- [x] Write e2e tests for critical API endpoints.
- [x] Create a `Dockerfile` for containerization.
- [x] Set up a CI/CD pipeline script (e.g., for GitHub Actions).