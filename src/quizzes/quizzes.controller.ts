import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { QuizzesService } from './quizzes.service';
import { CreateQuizDto, SubmitQuizDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';

interface AuthenticatedRequest {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

@Controller('quizzes')
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createQuizDto: CreateQuizDto, @Request() req: AuthenticatedRequest) {
    return this.quizzesService.create(createQuizDto, req.user.id);
  }

  @Get()
  findAllPublic() {
    return this.quizzesService.findAllPublic();
  }

  @Get('my-quizzes')
  @UseGuards(JwtAuthGuard)
  findMyQuizzes(@Request() req: AuthenticatedRequest) {
    return this.quizzesService.findMyQuizzes(req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.quizzesService.findOne(id, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.quizzesService.remove(id, req.user.id, req.user.role);
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  submitQuiz(
    @Param('id') id: string,
    @Body() submitQuizDto: SubmitQuizDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.quizzesService.submitQuiz(id, submitQuizDto, req.user.id);
  }
}
