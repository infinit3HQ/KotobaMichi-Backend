import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWordDto } from './dto/create-word.dto';
import { UpdateWordDto } from './dto/update-word.dto';

@Injectable()
export class WordsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createWordDto: CreateWordDto) {
    return this.prisma.word.create({
      data: createWordDto,
    });
  }

  async findAll(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    
    const [words, total] = await Promise.all([
      this.prisma.word.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.word.count(),
    ]);

    return {
      words,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const word = await this.prisma.word.findUnique({
      where: { id },
    });

    if (!word) {
      throw new NotFoundException(`Word with ID ${id} not found`);
    }

    return word;
  }

  async update(id: string, updateWordDto: UpdateWordDto) {
    // Check if word exists
    await this.findOne(id);

    return this.prisma.word.update({
      where: { id },
      data: updateWordDto,
    });
  }

  async remove(id: string) {
    // Check if word exists
    await this.findOne(id);

    return this.prisma.word.delete({
      where: { id },
    });
  }
}
