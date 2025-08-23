import { IsString, IsNotEmpty, IsOptional, IsIn, IsUrl, IsArray, ArrayMinSize, ArrayMaxSize } from 'class-validator';

// Aligns with current words schema: hiragana (required), english (required), optional kanji, romaji, pronunciationUrl, level, topic, partOfSpeech
// Removed legacy fields: katakana, pronunciation (renamed -> pronunciationUrl), meaning (renamed -> english)
export class CreateWordDto {
  @IsString()
  @IsNotEmpty()
  hiragana!: string;

  @IsString()
  @IsOptional()
  kanji?: string;

  @IsString()
  @IsOptional()
  romaji?: string;

  @IsString()
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'pronunciationUrl must be a valid URL with protocol' })
  pronunciationUrl?: string;

  @IsString()
  @IsNotEmpty()
  english!: string; // was 'meaning'

  @IsString()
  @IsOptional()
  @IsIn(['N5','N4','N3','N2','N1'], { message: 'level must be one of N5,N4,N3,N2,N1' })
  level?: string; // defaults to N5 in DB

  @IsString()
  @IsOptional()
  topic?: string;

  @IsString()
  @IsOptional()
  partOfSpeech?: string;

  @IsString()
  @IsOptional()
  vectorText?: string;

  // Optional embedding vector (must be length 768 if provided)
  @IsArray()
  @ArrayMinSize(768)
  @ArrayMaxSize(768)
  @IsOptional()
  vector?: number[];
}