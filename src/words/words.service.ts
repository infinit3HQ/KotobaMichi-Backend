import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '@/db/drizzle.service';
import { CreateWordDto } from './dto/create-word.dto';
import { UpdateWordDto } from './dto/update-word.dto';
import { v7 as uuidv7 } from 'uuid';
import { createHash } from 'crypto';
import { words } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

@Injectable()
export class WordsService {
	constructor(private readonly dbService: DbService) {}
	private get db() {
		return this.dbService.db;
	}

	/**
	 * Generate a hash for duplicate detection
	 */
	private generateContentHash(
		hiragana: string,
		kanji: string | null,
		english: string
	): string {
		// Trim and normalize inputs so equivalent values with extra spaces,
		// unicode variants or case differences produce the same hash.
		const normalizeAndFold = (s: string) =>
			s.trim().normalize('NFKC').toLowerCase();

		const h = normalizeAndFold(hiragana);
		const k = kanji ? normalizeAndFold(kanji) : '';
		const e = normalizeAndFold(english);

		// keep same separator and lowercase the joined string prior to hashing
		const content = `${h}|${k}|${e}`.toLowerCase();
		return createHash('sha256').update(content).digest('hex');
	}

	async create(createWordDto: CreateWordDto) {
		// Generate content hash for duplicate detection (hiragana|kanji|english)
		const contentHash = this.generateContentHash(
			createWordDto.hiragana,
			createWordDto.kanji || null,
			createWordDto.english
		);

		// Check if word already exists
		const existing = await this.db.query.words.findFirst({
			where: eq(words.contentHash, contentHash),
			columns: { id: true },
		});

		if (existing) {
			throw new Error('A word with similar content already exists');
		}

		// Insert
		const [inserted] = await this.db
			.insert(words)
			.values({
				id: uuidv7(),
				hiragana: createWordDto.hiragana,
				kanji: createWordDto.kanji || null,
				pronunciationUrl: createWordDto.pronunciationUrl || null,
				english: createWordDto.english,
				contentHash,
				romaji: createWordDto.romaji || null,
				level: createWordDto.level || 'N5',
				topic: createWordDto.topic || null,
				partOfSpeech: createWordDto.partOfSpeech || null,
				vectorText: createWordDto.vectorText || null,
				vector: createWordDto.vector as any, // drizzle pgvector expects number[] | null
			})
			.returning();
		return inserted;
	}

	async findAll(page: number = 1, limit: number = 10) {
		const skip = (page - 1) * limit;
		// UUIDv7 is roughly time-sortable, so ordering by primary key gives newest-first
		// Removing createdAt ORDER BY avoids an extra sort when no index existed.
		const [rows, countRows] = await Promise.all([
			this.db.query.words.findMany({
				// deterministic ordering by primary key (UUIDv7); ascending = oldest first
				orderBy: (w, { asc }) => [asc(w.id)],
				limit,
				offset: skip,
				// select only commonly needed columns (omit large / rarely used ones)
				columns: {
					id: true,
					kanji: true,
					hiragana: true,
					romaji: true,
					english: true,
					pronunciationUrl: true,
					level: true,
					createdAt: true,
				},
			}),
			this.db.select({ value: sql<number>`count(*)` }).from(words),
		]);
		const total = Number(countRows?.[0]?.value || 0);

		return {
			words: rows,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	async findOne(id: string) {
		const word = await this.db.query.words.findFirst({
			where: eq(words.id, id),
		});

		if (!word) {
			throw new NotFoundException(`Word with ID ${id} not found`);
		}

		return word;
	}

	async update(id: string, updateWordDto: UpdateWordDto) {
		// Check if word exists
		await this.findOne(id);
		const updateData: any = { updatedAt: new Date() };
		if (updateWordDto.hiragana !== undefined)
			updateData.hiragana = updateWordDto.hiragana;
		if (updateWordDto.kanji !== undefined)
			updateData.kanji = updateWordDto.kanji;
		if (updateWordDto.romaji !== undefined)
			updateData.romaji = updateWordDto.romaji;
		if (updateWordDto.pronunciationUrl !== undefined)
			updateData.pronunciationUrl = updateWordDto.pronunciationUrl;
		if (updateWordDto.english !== undefined)
			updateData.english = updateWordDto.english;
		if (updateWordDto.level !== undefined)
			updateData.level = updateWordDto.level;
		if (updateWordDto.topic !== undefined)
			updateData.topic = updateWordDto.topic;
		if (updateWordDto.partOfSpeech !== undefined)
			updateData.partOfSpeech = updateWordDto.partOfSpeech;
		if (updateWordDto.vectorText !== undefined)
			updateData.vectorText = updateWordDto.vectorText;
		if (updateWordDto.vector !== undefined)
			updateData.vector = updateWordDto.vector as any;
		const [updated] = await this.db
			.update(words)
			.set(updateData)
			.where(eq(words.id, id))
			.returning();
		return updated;
	}

	async remove(id: string) {
		// Check if word exists
		await this.findOne(id);
		const [deleted] = await this.db
			.delete(words)
			.where(eq(words.id, id))
			.returning();
		return deleted;
	}
}
