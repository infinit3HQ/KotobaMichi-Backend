import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateWordDto {
  @IsString()
  @IsNotEmpty()
  hiragana: string;

  @IsString()
  @IsNotEmpty()
  katakana: string;

  @IsString()
  @IsOptional()
  kanji?: string;

  @IsString()
  @IsNotEmpty()
  pronunciation: string;

  @IsString()
  @IsNotEmpty()
  meaning: string;
} 