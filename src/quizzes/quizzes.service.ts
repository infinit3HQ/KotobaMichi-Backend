import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuizDto, SubmitQuizDto } from './dto';

@Injectable()
export class QuizzesService {
  constructor(private prisma: PrismaService) {}

  async create(createQuizDto: CreateQuizDto, userId: string) {
    const { wordIds, ...quizData } = createQuizDto;

    // Verify all words exist
    const words = await this.prisma.word.findMany({
      where: { id: { in: wordIds } },
    });

    if (words.length !== wordIds.length) {
      throw new BadRequestException('One or more words not found');
    }

    return this.prisma.quiz.create({
      data: {
        ...quizData,
        createdById: userId,
        quizWords: {
          create: wordIds.map((wordId) => ({ wordId })),
        },
      },
      include: {
        creator: {
          select: { id: true, email: true, role: true },
        },
        quizWords: {
          include: {
            word: true,
          },
        },
        _count: {
          select: { attempts: true },
        },
      },
    });
  }

  async findAllPublic() {
    return this.prisma.quiz.findMany({
      where: { isPublic: true },
      include: {
        creator: {
          select: { id: true, email: true, role: true },
        },
        _count: {
          select: { quizWords: true, attempts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMyQuizzes(userId: string) {
    return this.prisma.quiz.findMany({
      where: { createdById: userId },
      include: {
        creator: {
          select: { id: true, email: true, role: true },
        },
        _count: {
          select: { quizWords: true, attempts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId?: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, email: true, role: true },
        },
        quizWords: {
          include: {
            word: true,
          },
        },
        _count: {
          select: { attempts: true },
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // Check if user can access this quiz
    if (!quiz.isPublic && quiz.createdById !== userId) {
      throw new ForbiddenException('Access denied to this quiz');
    }

    return quiz;
  }

  async remove(id: string, userId: string, userRole: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      select: { id: true, createdById: true },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // Check if user can delete this quiz (creator or admin)
    if (quiz.createdById !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.quiz.delete({
      where: { id },
    });

    return { message: 'Quiz deleted successfully' };
  }

  async submitQuiz(id: string, submitQuizDto: SubmitQuizDto, userId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        quizWords: {
          include: {
            word: true,
          },
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // Check if user can access this quiz
    if (!quiz.isPublic && quiz.createdById !== userId) {
      throw new ForbiddenException('Access denied to this quiz');
    }

    const { answers } = submitQuizDto;
    const quizWords = quiz.quizWords;
    
    // Validate that all quiz words have answers
    const submittedWordIds = answers.map(a => a.wordId);
    const requiredWordIds = quizWords.map(qw => qw.wordId);
    
    const missingAnswers = requiredWordIds.filter(id => !submittedWordIds.includes(id));
    if (missingAnswers.length > 0) {
      throw new BadRequestException('Missing answers for some words');
    }

    // Calculate score
    let correctAnswers = 0;
    const results = answers.map(answer => {
      const quizWord = quizWords.find(qw => qw.wordId === answer.wordId);
      if (!quizWord) {
        throw new BadRequestException(`Invalid word ID: ${answer.wordId}`);
      }

      const word = quizWord.word;
      // Check if answer matches any of the word forms (case insensitive)
      const isCorrect = 
        answer.answer.toLowerCase() === word.hiragana.toLowerCase() ||
        (word.katakana && answer.answer.toLowerCase() === word.katakana.toLowerCase()) ||
        (word.kanji && answer.answer.toLowerCase() === word.kanji.toLowerCase()) ||
        answer.answer.toLowerCase() === word.meaning.toLowerCase();

      if (isCorrect) {
        correctAnswers++;
      }

      return {
        wordId: answer.wordId,
        userAnswer: answer.answer,
        correctAnswers: [
          word.hiragana,
          word.katakana,
          word.kanji,
          word.meaning,
        ].filter(Boolean),
        isCorrect,
        word: {
          hiragana: word.hiragana,
          katakana: word.katakana,
          kanji: word.kanji,
          pronunciation: word.pronunciation,
          meaning: word.meaning,
        },
      };
    });

    const score = Math.round((correctAnswers / quizWords.length) * 100);

    // Save quiz attempt
    const quizAttempt = await this.prisma.quizAttempt.create({
      data: {
        userId,
        quizId: id,
        score,
      },
    });

    return {
      attemptId: quizAttempt.id,
      score,
      totalQuestions: quizWords.length,
      correctAnswers,
      results,
    };
  }
}
