import {
	Injectable,
	NotFoundException,
	ForbiddenException,
	BadRequestException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { DbService } from '@/db/drizzle.service';
import { CreateQuizDto, SubmitQuizDto } from './dto';
import { quizzes, quizWords, words, quizAttempts } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

@Injectable()
export class QuizzesService {
	constructor(private dbService: DbService) {}
	private get db() {
		return this.dbService.db;
	}

	async create(createQuizDto: CreateQuizDto, userId: string) {
		const { wordIds = [], ...quizData } = createQuizDto;
		// Deduplicate word IDs early to avoid unique constraint violations
		const dedupedWordIds = Array.from(new Set(wordIds));

		// Verify all words exist (use deduplicated ids)
		const wordRows = await this.db.query.words.findMany({
			where: (w, { inArray }) => inArray(w.id, dedupedWordIds),
		});
		if (wordRows.length !== dedupedWordIds.length) {
			throw new BadRequestException('One or more words not found');
		}
		const quizId = uuidv7();
		await this.db.insert(quizzes).values({
			id: quizId,
			title: quizData.title,
			description: quizData.description || null,
			isPublic: !!quizData.isPublic,
			createdById: userId,
		});
		if (dedupedWordIds.length) {
			await this.db.insert(quizWords).values(
				dedupedWordIds.map(wid => ({
					id: uuidv7(),
					quizId,
					wordId: wid,
				}))
			);
		}
		return this.findOne(quizId, userId);
	}

	async findAllPublic() {
		const rows = await this.db.query.quizzes.findMany({
			where: eq(quizzes.isPublic, true),
			orderBy: (q, { desc }) => [desc(q.createdAt)],
		});
		// counts
		const result = [] as any[];
		for (const q of rows) {
			const [qwCount] = await this.db
				.select({ v: sql<number>`count(*)` })
				.from(quizWords)
				.where(eq(quizWords.quizId, q.id));
			const [attCount] = await this.db
				.select({ v: sql<number>`count(*)` })
				.from(quizAttempts)
				.where(eq(quizAttempts.quizId, q.id));
			result.push({
				...q,
				_count: {
					quizWords: Number(qwCount?.v || 0),
					attempts: Number(attCount?.v || 0),
				},
			});
		}
		return result;
	}

	async findMyQuizzes(userId: string) {
		const rows = await this.db.query.quizzes.findMany({
			where: eq(quizzes.createdById, userId),
			orderBy: (q, { desc }) => [desc(q.createdAt)],
		});
		const result = [] as any[];
		for (const q of rows) {
			const [qwCount] = await this.db
				.select({ v: sql<number>`count(*)` })
				.from(quizWords)
				.where(eq(quizWords.quizId, q.id));
			const [attCount] = await this.db
				.select({ v: sql<number>`count(*)` })
				.from(quizAttempts)
				.where(eq(quizAttempts.quizId, q.id));
			result.push({
				...q,
				_count: {
					quizWords: Number(qwCount?.v || 0),
					attempts: Number(attCount?.v || 0),
				},
			});
		}
		return result;
	}

	async findOne(id: string, userId?: string) {
		const quiz = await this.db.query.quizzes.findFirst({
			where: eq(quizzes.id, id),
		});

		if (!quiz) {
			throw new NotFoundException('Quiz not found');
		}

		// Check if user can access this quiz
		if (!quiz.isPublic && quiz.createdById !== userId) {
			throw new ForbiddenException('Access denied to this quiz');
		}
		const qWords = await this.db.query.quizWords.findMany({
			where: eq(quizWords.quizId, quiz.id),
		});
		const wordsMap = [] as any[];
		for (const qw of qWords) {
			const w = await this.db.query.words.findFirst({
				where: eq(words.id, qw.wordId),
			});
			if (w) wordsMap.push({ ...qw, word: w });
		}
		const [attCount] = await this.db
			.select({ v: sql<number>`count(*)` })
			.from(quizAttempts)
			.where(eq(quizAttempts.quizId, quiz.id));
		return {
			...quiz,
			quizWords: wordsMap,
			_count: { attempts: Number(attCount?.v || 0) },
		};
	}

	async remove(id: string, userId: string, userRole: string) {
		const quiz = await this.db.query.quizzes.findFirst({
			where: eq(quizzes.id, id),
			columns: { id: true, createdById: true },
		});

		if (!quiz) {
			throw new NotFoundException('Quiz not found');
		}

		// Check if user can delete this quiz (creator or admin)
		if (quiz.createdById !== userId && userRole !== 'ADMIN') {
			throw new ForbiddenException('Access denied');
		}

		await this.db.delete(quizzes).where(eq(quizzes.id, id));

		return { message: 'Quiz deleted successfully' };
	}

	async submitQuiz(id: string, submitQuizDto: SubmitQuizDto, userId: string) {
		const quiz = await this.db.query.quizzes.findFirst({
			where: eq(quizzes.id, id),
		});

		if (!quiz) {
			throw new NotFoundException('Quiz not found');
		}

		// Check if user can access this quiz
		if (!quiz.isPublic && quiz.createdById !== userId) {
			throw new ForbiddenException('Access denied to this quiz');
		}

		const { answers } = submitQuizDto;
		const qWords = await this.db.query.quizWords.findMany({
			where: eq(quizWords.quizId, quiz.id),
		});
		const attached = [] as any[];
		for (const qw of qWords) {
			const w = await this.db.query.words.findFirst({
				where: eq(words.id, qw.wordId),
			});
			if (w) attached.push({ ...qw, word: w });
		}

		// Validate that all quiz words have answers
		const submittedWordIds = answers.map(a => a.wordId);
		const requiredWordIds = attached.map(qw => qw.wordId);

		const missingAnswers = requiredWordIds.filter(
			id => !submittedWordIds.includes(id)
		);
		if (missingAnswers.length > 0) {
			throw new BadRequestException('Missing answers for some words');
		}

		// Guard against duplicate answers for the same word
		const answerIdsSet = new Set(answers.map(a => a.wordId));
		if (answerIdsSet.size !== answers.length) {
			throw new BadRequestException('Duplicate answers detected');
		}

		// Calculate score by iterating requiredWordIds so each required word is counted exactly once.
		// Ignore any extra answers the client may have sent that are not part of requiredWordIds.
		let correctAnswers = 0;
		const answerMap = new Map(answers.map(a => [a.wordId, a]));
		const results = requiredWordIds.map(wordId => {
			const quizWord = attached.find(qw => qw.wordId === wordId);
			if (!quizWord) {
				// This should not happen, but guard defensively
				throw new BadRequestException(`Invalid word ID: ${wordId}`);
			}

			const word = quizWord.word;
			const answer = answerMap.get(wordId);
			const userAnswer = answer?.answer ?? '';

			// Check if answer matches any of the word forms (case insensitive)
			const ansLower = (userAnswer || '').toLowerCase();
			const isCorrect =
				ansLower === (word.hiragana || '').toLowerCase() ||
				(word.kanji && ansLower === (word.kanji || '').toLowerCase()) ||
				ansLower === (word.english || '').toLowerCase();

			if (isCorrect) correctAnswers++;

			return {
				wordId,
				userAnswer,
				correctAnswers: [word.hiragana, word.kanji, word.english].filter(
					Boolean
				),
				isCorrect,
				word: {
					hiragana: word.hiragana,
					kanji: word.kanji,
					pronunciationUrl: word.pronunciationUrl,
					english: word.english,
				},
			};
		});

		// Guard against division-by-zero if there are no attached words
		let score = 0;
		if (attached.length > 0) {
			score = Math.round((correctAnswers / attached.length) * 100);
		}

		// Save quiz attempt
		const [attempt] = await this.db
			.insert(quizAttempts)
			.values({
				id: uuidv7(),
				userId,
				quizId: id,
				score,
				completedAt: new Date(),
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();

		return {
			attemptId: attempt?.id,
			score,
			totalQuestions: attached.length,
			correctAnswers,
			results,
		};
	}
}
