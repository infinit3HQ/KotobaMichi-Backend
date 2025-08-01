# KotobaMichi(言葉道)-Backend

KotobaMichi is a JLPT N5 vocabulary learning platform that helps users learn Japanese vocabulary through interactive quizzes and spaced repetition. This repository contains the backend code for the KotobaMichi platform, built with NestJS, Prisma, and TypeScript.

## Features

- 🔐 **Authentication & Authorization** - JWT-based auth with role-based access control
- 📚 **Vocabulary Management** - CRUD operations for Japanese words with hiragana, katakana, kanji, and meanings
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

### Authentication (`/auth`)
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user and get JWT token

### Vocabulary (`/words`)
- `GET /words` - Get paginated list of words
- `GET /words/:id` - Get single word details
- `POST /words` - Create new word (Admin only)
- `PATCH /words/:id` - Update word (Admin only)
- `DELETE /words/:id` - Delete word (Admin only)

### Quizzes (`/quizzes`)
- `GET /quizzes` - Get all public quizzes
- `GET /quizzes/my-quizzes` - Get user's created quizzes
- `GET /quizzes/:id` - Get quiz details with words
- `POST /quizzes` - Create new quiz
- `DELETE /quizzes/:id` - Delete quiz (creator/admin only)
- `POST /quizzes/:id/submit` - Submit quiz answers and get results

### Users (`/users`)
- `GET /users/me` - Get user profile
- `GET /users/me/attempts` - Get user's quiz attempt history (paginated)
- `GET /users/me/stats` - Get user's learning statistics

### Health Check
- `GET /health` - API health check

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

5. Start the development server:
```bash
pnpm run start:dev
```

The API will be available at `http://localhost:3000`

## Environment Variables

```env
DATABASE_URL="postgresql://username:password@localhost:5432/kotoba_michi"
JWT_SECRET="your-super-secret-jwt-key"
PORT=3000
```

## Database Schema

The application uses the following main entities:

- **User** - User accounts with email, password, and role
- **Word** - Japanese vocabulary with hiragana, katakana, kanji, pronunciation, and meaning
- **Quiz** - Quiz collections linking multiple words
- **QuizWord** - Many-to-many relationship between quizzes and words
- **QuizAttempt** - User quiz attempts with scores and completion times

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