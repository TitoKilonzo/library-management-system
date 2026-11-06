import { PartialType } from '@nestjs/mapped-types';
import { CreateBookDto } from './create-book.dto';

// Every field becomes optional but keeps its validation rules.
export class UpdateBookDto extends PartialType(CreateBookDto) {}
