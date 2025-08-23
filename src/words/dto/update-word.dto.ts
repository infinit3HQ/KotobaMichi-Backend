import { PartialType } from '@nestjs/mapped-types';
import { CreateWordDto } from './create-word.dto';
import { IsArray, ArrayMinSize, ArrayMaxSize, IsOptional } from 'class-validator';

// All fields optional for update. Redeclare vector to ensure validators run
export class UpdateWordDto extends PartialType(CreateWordDto) {
	@IsArray()
	@ArrayMinSize(768)
	@ArrayMaxSize(768)
	@IsOptional()
		override vector?: number[];
}