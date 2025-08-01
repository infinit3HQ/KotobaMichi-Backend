import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

export class QuizAnswerDto {
  @IsString()
  @IsNotEmpty()
  wordId: string;

  @IsString()
  @IsNotEmpty()
  answer: string;
}

export class SubmitQuizDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers: QuizAnswerDto[];
}
