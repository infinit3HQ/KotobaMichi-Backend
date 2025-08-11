import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, ArrayNotEmpty } from 'class-validator';

export class CreateQuizDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  wordIds: string[];
}
