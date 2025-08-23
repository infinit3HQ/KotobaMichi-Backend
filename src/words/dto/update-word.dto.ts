import { PartialType } from '@nestjs/mapped-types';
import { CreateWordDto } from './create-word.dto';

// All fields optional for update
export class UpdateWordDto extends PartialType(CreateWordDto) {}