import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            createdQuizzes: true,
            quizAttempts: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getUserQuizAttempts(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const attempts = await this.prisma.quizAttempt.findMany({
      where: { userId },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
      },
      orderBy: { completedAt: 'desc' },
      skip,
      take: limit,
    });

    const totalCount = await this.prisma.quizAttempt.count({
      where: { userId },
    });

    return {
      attempts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  async getUserStats(userId: string) {
    // Get user's quiz statistics
    const stats = await this.prisma.quizAttempt.groupBy({
      by: ['userId'],
      where: { userId },
      _avg: { score: true },
      _max: { score: true },
      _min: { score: true },
      _count: { id: true },
    });

    const userStat = stats[0] || {
      _avg: { score: 0 },
      _max: { score: 0 },
      _min: { score: 0 },
      _count: { id: 0 },
    };

    // Get recent quiz attempts (last 5)
    const recentAttempts = await this.prisma.quizAttempt.findMany({
      where: { userId },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: 5,
    });

    return {
      totalAttempts: userStat._count.id,
      averageScore: userStat._avg.score || 0,
      highestScore: userStat._max.score || 0,
      lowestScore: userStat._min.score || 0,
      recentAttempts,
    };
  }
}
