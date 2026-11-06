import { PartialType } from '@nestjs/mapped-types';
import { CreateGenreDto } from './create-genre.dto';

// Every field becomes optional but keeps its validation rules.
export class UpdateGenreDto extends PartialType(CreateGenreDto) {}
