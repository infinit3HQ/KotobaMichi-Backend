import {
	pgTable,
	text,
	varchar,
	boolean,
	timestamp,
	pgEnum,
	index,
	uniqueIndex,
	vector,
	integer,
} from 'drizzle-orm/pg-core';

// Enum equivalent of Prisma UserRole
export const userRoleEnum = pgEnum('UserRole', ['USER', 'ADMIN']);

// Users table
export const users = pgTable('users', {
	id: varchar('id', { length: 128 }).primaryKey(), // full UUID v7 (128 incl dashes)
	email: text('email').notNull().unique(),
	password: text('password').notNull(),
	role: userRoleEnum('role').notNull().default('USER'),
	isEmailVerified: boolean('is_email_verified').notNull().default(false),
	createdAt: timestamp('created_at', { withTimezone: false })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: false })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});

// Words table
export const words = pgTable(
	'words',
	{
		id: varchar('id', { length: 128 }).primaryKey(),
		hiragana: text('hiragana').notNull(),
		kanji: text('kanji'),
		romaji: text('romaji'), // Hepburn reading
		english: text('english').notNull(),
		level: varchar('level', { length: 8 }).notNull().default('N5'),
		pronunciationUrl: text('pronunciation_url'),
		topic: text('topic'),
		partOfSpeech: text('part_of_speech'),
		vector: vector('vector', { dimensions: 768 }), // pgvector embedding (optional for now)
		vectorText: text('vector_text'), // source text used to generate embedding
		contentHash: text('content_hash').notNull().unique(),
		createdAt: timestamp('created_at', { withTimezone: false })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: false })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	t => [
		index('words_topic_idx').on(t.topic),
		index('words_vector_cosine_idx').using('hnsw', t.vector.op('vector_cosine_ops'))
	]
);

// Quizzes table
export const quizzes = pgTable(
	'quizzes',
	{
		id: varchar('id', { length: 128 }).primaryKey(),
		title: text('title').notNull(),
		description: text('description'),
		isPublic: boolean('is_public').notNull().default(false),
		createdById: varchar('created_by_id', { length: 32 })
			.notNull()
			.references(() => users.id, { onDelete: 'cascade', onUpdate: 'no action' }),
		createdAt: timestamp('created_at', { withTimezone: false })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: false })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	t => [index('quizzes_created_by_idx').on(t.createdById)]
);

// Quiz Words junction
export const quizWords = pgTable(
	'quiz_words',
	{
		id: varchar('id', { length: 128 }).primaryKey(),
		quizId: varchar('quiz_id', { length: 128 })
			.notNull()
			.references(() => quizzes.id, { onDelete: 'cascade' }),
		wordId: varchar('word_id', { length: 128 })
			.notNull()
			.references(() => words.id, { onDelete: 'cascade' }),
	},
	t => [
		uniqueIndex('quiz_words_quiz_word_unique').on(t.quizId, t.wordId),
		index('quiz_words_quiz_idx').on(t.quizId),
		index('quiz_words_word_idx').on(t.wordId),
	]
);

// Quiz Attempts
export const quizAttempts = pgTable(
	'quiz_attempts',
	{
		id: varchar('id', { length: 128 }).primaryKey(),
		userId: varchar('user_id', { length: 128 })
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		quizId: varchar('quiz_id', { length: 128 })
			.notNull()
			.references(() => quizzes.id, { onDelete: 'cascade' }),
		score: integer('score').notNull(),
		completedAt: timestamp('completed_at', { withTimezone: false })
			.notNull()
			.defaultNow(),
		createdAt: timestamp('created_at', { withTimezone: false })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: false })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	t => [
		index('quiz_attempts_user_idx').on(t.userId),
		index('quiz_attempts_quiz_idx').on(t.quizId),
	]
);

// Refresh Tokens
export const refreshTokens = pgTable(
	'refresh_tokens',
	{
		id: varchar('id', { length: 128 }).primaryKey(),
		jti: text('jti').notNull().unique(),
		userId: varchar('user_id', { length: 128 })
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		tokenHash: text('token_hash').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: false }).notNull(),
		revokedAt: timestamp('revoked_at', { withTimezone: false }),
		replacedById: varchar('replaced_by_id', { length: 128 }),
		createdAt: timestamp('created_at', { withTimezone: false })
			.notNull()
			.defaultNow(),
	},
	t => [index('refresh_tokens_user_idx').on(t.userId)]
);

// Email Verification Tokens
export const emailVerificationTokens = pgTable(
	'email_verification_tokens',
	{
		id: varchar('id', { length: 128 }).primaryKey(),
		userId: varchar('user_id', { length: 128 })
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		tokenHash: text('token_hash').notNull().unique(),
		expiresAt: timestamp('expires_at', { withTimezone: false }).notNull(),
		usedAt: timestamp('used_at', { withTimezone: false }),
		createdAt: timestamp('created_at', { withTimezone: false })
			.notNull()
			.defaultNow(),
	},
	t => [index('email_verification_tokens_user_idx').on(t.userId)]
);

// Password Reset Tokens
export const passwordResetTokens = pgTable(
	'password_reset_tokens',
	{
		id: varchar('id', { length: 128 }).primaryKey(),
		userId: varchar('user_id', { length: 128 })
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		tokenHash: text('token_hash').notNull().unique(),
		expiresAt: timestamp('expires_at', { withTimezone: false }).notNull(),
		usedAt: timestamp('used_at', { withTimezone: false }),
		createdAt: timestamp('created_at', { withTimezone: false })
			.notNull()
			.defaultNow(),
	},
	t => [index('password_reset_tokens_user_idx').on(t.userId)]
);

// NOTE: Foreign keys & cascades are defined directly since dev DB can be reset.

// Placeholder for future vector column example:
// import { vector, index } from 'drizzle-orm/pg-core';
// export const embeddingsExample = pgTable('embeddings_example', {
//   id: varchar('id', { length: 32 }).primaryKey(),
//   embedding: vector('embedding', { dimensions: 15128 })
// }, (t) => [
//   index('embedding_cosine_idx').using('hnsw', t.embedding.op('vector_cosine_ops'))
// ]);
