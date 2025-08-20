# KotobaMichi(言葉道)-Backend

KotobaMichi is a JLPT N5 vocabulary learning platform that helps users learn Japanese vocabulary through interactive quizzes and spaced repetition. This repository contains the backend code for the KotobaMichi platform, built with NestJS, Prisma, and TypeScript.

## Features

- 🔐 **Authentication & Authorization** - JWT-based auth with role-based access control
	- Secure HttpOnly cookies for access/refresh tokens
	- Refresh token rotation with reuse detection and server-side revocation
- 📚 **Vocabulary Management** - CRUD operations for Japanese words with hiragana, katakana, kanji, and meanings
- 📥 **CSV Import System** - Optimized bulk import with hash-based duplicate detection and batch processing
- 🧩 **Quiz System** - Create and take quizzes with automatic scoring
- 👤 **User Profiles** - User dashboard with quiz history and statistics
- 📊 **Analytics** - Track learning progress and performance metrics

## Tech Stack

- **Framework**: NestJS (Node.js)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with Passport.js
- **Validation**: class-validator
- **Testing**: Jest + Supertest
- **Documentation**: OpenAPI/Swagger (planned)

## API Endpoints

All routes are prefixed with `/v1`.

### Authentication (`/auth`)
- `POST /v1/auth/register` - Register a new user; sends verification email; returns message only
- `POST /v1/auth/register/admin` - Register a new admin (requires existing admin; guarded by JWT + role)
- `POST /v1/auth/login` - Login; sets HttpOnly cookies and returns `{ access_token, refresh_token, user }`
- `POST /v1/auth/logout` - Revoke refresh tokens and clear cookies; returns `{ success: true }`
- `GET /v1/auth/validate` - Validate current access cookie; returns `{ valid: true, user }` or 401 and clears cookies
- `POST /v1/auth/refresh` - Rotate tokens using refresh cookie; sets new cookies and returns `{ access_token, refresh_token, user }`
- `POST /v1/auth/verify-email` - Verify a user's email with `{ token }`
- `POST /v1/auth/resend-verification` - Resend verification email with `{ email }`
- `POST /v1/auth/forgot-password` - Start password reset with `{ email }`
- `POST /v1/auth/reset-password` - Complete password reset with `{ token, newPassword }`

### Vocabulary (`/words`)
- `GET /v1/words` - Get paginated list of words
- `GET /v1/words/:id` - Get single word details
- `POST /v1/words` - Create new word (Admin only)
- `PATCH /v1/words/:id` - Update word (Admin only)
- `DELETE /v1/words/:id` - Delete word (Admin only)
- `POST /v1/words/import/csv` - Import words from CSV file (Admin only)
- `GET /v1/words/import/stats` - Get import statistics (Admin only)
- `DELETE /v1/words/import/clear-all` - Clear all words (Admin only)

### Quizzes (`/quizzes`)
- `GET /v1/quizzes` - Get all public quizzes
- `GET /v1/quizzes/my-quizzes` - Get user's created quizzes
- `GET /v1/quizzes/:id` - Get quiz details with words
- `POST /v1/quizzes` - Create new quiz
- `DELETE /v1/quizzes/:id` - Delete quiz (creator/admin only)
- `POST /v1/quizzes/:id/submit` - Submit quiz answers and get results

### Users (`/users`)
- `GET /v1/users/me` - Get user profile
- `GET /v1/users/me/attempts` - Get user's quiz attempt history (paginated)
- `GET /v1/users/me/stats` - Get user's learning statistics

### Health Check
- `GET /v1/health` - API health check

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd KotobaMichi-Backend
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database URL, JWT secret, etc.
```

4. Set up the database:
```bash
# Run migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# (Optional) Seed database
npx prisma db seed
```

5. Import vocabulary data:
```bash
# Import Japanese N5 vocabulary from CSV
pnpm run import:csv
```

6. Start the development server:
```bash
pnpm run start:dev
```

Base URL: `http://localhost:3000/v1`

Authentication uses secure HttpOnly cookies. When running cross-origin in production, ensure HTTPS and proper CORS/ cookie settings (see Environment Variables below).

## Environment Variables

See `.env.example` for a complete list. Key settings:

```env
# Core
DATABASE_URL="postgresql://username:password@localhost:5432/kotoba_michi"
PORT=3000

# JWT
JWT_SECRET="your-super-secret-jwt-key"      # required
JWT_EXPIRES_IN=7d                            # default for JwtModule (not used for access/refresh below)
ACCESS_TOKEN_EXPIRES_IN=15m                  # override per token
REFRESH_TOKEN_EXPIRES_IN=7d

# Cookies & CORS
CORS_ORIGIN=http://localhost:5173            # CSV of allowed origins
COOKIE_SECRET=dev-cookie-secret              # for cookie-parser (optional)
COOKIE_SECURE=false                          # true in production (HTTPS)
COOKIE_SAMESITE=lax                          # none|lax|strict
```

Notes:
- Tokens are issued as cookies: `access_token` (short-lived) and `refresh_token` (longer-lived).
- `/v1/auth/refresh` rotates refresh tokens and revokes previous ones; suspicious reuse revokes all user tokens.
- Bearer Authorization works, but cookies are preferred and used by default.
- Frontend integration tips are in [FRONTEND_AUTH_GUIDE.md](./FRONTEND_AUTH_GUIDE.md).

## Database Schema

The application uses the following main entities:

- **User** - User accounts with email, password, and role
- **Word** - Japanese vocabulary with hiragana, katakana, kanji, pronunciation, meaning, and contentHash for duplicate detection
- **Quiz** - Quiz collections linking multiple words
- **QuizWord** - Many-to-many relationship between quizzes and words
- **QuizAttempt** - User quiz attempts with scores and completion times

## CSV Import System

The application includes an optimized CSV import system for bulk vocabulary loading:

### Features
- **Hash-based duplicate detection** using SHA-256 for fast lookups
- **Batch processing** (100 words per batch) for optimal performance
- **Comprehensive validation** and error reporting
- **Import statistics** and progress tracking

### Usage
```bash
# Import vocabulary from CSV file
pnpm run import:csv
```

### CSV Format
The system expects CSV files with these columns:
- `Kanji`: Japanese kanji characters (optional)
- `Hiragana`: Japanese hiragana reading (required)
- `English`: English meaning (required) 
- `PronunciationURL`: URL to audio pronunciation (required)

For detailed documentation, see [CSV_IMPORT_GUIDE.md](./CSV_IMPORT_GUIDE.md)

## Testing

Run unit tests:
```bash
pnpm run test
```

Run e2e tests:
```bash
pnpm run test:e2e
```

Run tests with coverage:
```bash
pnpm run test:cov
```

## Docker

Build and run with Docker:

```bash
# Build image
docker build -t kotoba-michi-backend .

# Run container
docker run -p 3000:3000 --env-file .env kotoba-michi-backend
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License.