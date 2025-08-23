import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '@/db/drizzle.service';
import { users, quizzes, quizAttempts } from '@/db/schema';
import { eq, sql, desc } from 'drizzle-orm';

@Injectable()
export class UsersService {
  constructor(private dbService: DbService) {}

  private get db() { return this.dbService.db; }

  async getUserProfile(userId: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, email: true, role: true, createdAt: true, updatedAt: true }
    });
    if (!user) throw new NotFoundException('User not found');
    const [createdQuizzesCount] = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(quizzes)
      .where(eq(quizzes.createdById, userId));
    const [quizAttemptsCount] = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(quizAttempts)
      .where(eq(quizAttempts.userId, userId));
    return {
      ...user,
      _count: {
        createdQuizzes: Number(createdQuizzesCount?.value || 0),
        quizAttempts: Number(quizAttemptsCount?.value || 0)
      }
    };
  }

  async getUserQuizAttempts(userId: string, page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;
    const attemptsRows = await this.db
      .select({
        id: quizAttempts.id,
        userId: quizAttempts.userId,
        quizId: quizAttempts.quizId,
        score: quizAttempts.score,
        completedAt: quizAttempts.completedAt,
        createdAt: quizAttempts.createdAt,
        updatedAt: quizAttempts.updatedAt,
        quiz_id: quizzes.id,
        quiz_title: quizzes.title,
        quiz_description: quizzes.description,
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .where(eq(quizAttempts.userId, userId))
      .orderBy(desc(quizAttempts.completedAt))
      .limit(limit)
      .offset(offset);

    const [totalCountRow] = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(quizAttempts)
      .where(eq(quizAttempts.userId, userId));
    const totalCount = Number(totalCountRow?.value || 0);
    const attempts = attemptsRows.map(r => ({
      id: r.id,
      userId: r.userId,
      quizId: r.quizId,
      score: r.score,
      completedAt: r.completedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      quiz: { id: r.quiz_id, title: r.quiz_title, description: r.quiz_description }
    }));
    return {
      attempts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit) || 1,
        totalCount,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPreviousPage: page > 1,
      }
    };
  }

  async getUserStats(userId: string) {
    const [agg] = await this.db
      .select({
        avgScore: sql<number>`coalesce(avg(${quizAttempts.score}),0)` ,
        maxScore: sql<number>`coalesce(max(${quizAttempts.score}),0)` ,
        minScore: sql<number>`coalesce(min(${quizAttempts.score}),0)` ,
        total: sql<number>`count(*)` ,
      })
      .from(quizAttempts)
      .where(eq(quizAttempts.userId, userId));

    const recentRows = await this.db
      .select({
        id: quizAttempts.id,
        userId: quizAttempts.userId,
        quizId: quizAttempts.quizId,
        score: quizAttempts.score,
        completedAt: quizAttempts.completedAt,
        createdAt: quizAttempts.createdAt,
        updatedAt: quizAttempts.updatedAt,
        quiz_id: quizzes.id,
        quiz_title: quizzes.title,
        quiz_description: quizzes.description,
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .where(eq(quizAttempts.userId, userId))
      .orderBy(desc(quizAttempts.completedAt))
      .limit(5);

    const recentAttempts = recentRows.map(r => ({
      id: r.id,
      userId: r.userId,
      quizId: r.quizId,
      score: r.score,
      completedAt: r.completedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      quiz: { id: r.quiz_id, title: r.quiz_title, description: r.quiz_description }
    }));

    return {
      totalAttempts: Number(agg?.total || 0),
      averageScore: Number(agg?.avgScore || 0),
      highestScore: Number(agg?.maxScore || 0),
      lowestScore: Number(agg?.minScore || 0),
      recentAttempts,
    };
  }
}
