import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FOREIGN_KEY_CONSTRAINT,
  isPrismaError,
  UNIQUE_CONSTRAINT,
} from '../prisma/prisma-errors';
import { CreateGenreDto } from './dto/create-genre.dto';
import { UpdateGenreDto } from './dto/update-genre.dto';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class GenresService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.genre.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { books: true } } },
    });
  }

  async findOne(id: number) {
    const genre = await this.prisma.genre.findUnique({
      where: { id },
      include: { _count: { select: { books: true } } },
    });
    if (!genre) throw new NotFoundException(`Genre ${id} not found`);
    return genre;
  }

  async create(dto: CreateGenreDto) {
    try {
      return await this.prisma.genre.create({
        data: { name: dto.name, slug: dto.slug ?? slugify(dto.name) },
      });
    } catch (error) {
      throw this.translate(error);
    }
  }

  async update(id: number, dto: UpdateGenreDto) {
    await this.findOne(id); // 404 if it doesn't exist
    // If the name changes but no slug was sent, keep the existing slug.
    try {
      return await this.prisma.genre.update({
        where: { id },
        data: { name: dto.name, slug: dto.slug },
      });
    } catch (error) {
      throw this.translate(error);
    }
  }

  async remove(id: number) {
    const genre = await this.findOne(id);
    if (genre._count.books > 0) {
      throw new ConflictException(
        `Genre ${id} still has ${genre._count.books} book(s); move or delete them first`,
      );
    }
    try {
      return await this.prisma.genre.delete({ where: { id } });
    } catch (error) {
      throw this.translate(error);
    }
  }

  private translate(error: unknown): unknown {
    if (isPrismaError(error, UNIQUE_CONSTRAINT)) {
      return new ConflictException('A genre with this name or slug already exists');
    }
    if (isPrismaError(error, FOREIGN_KEY_CONSTRAINT)) {
      return new ConflictException('Genre is still referenced by other records');
    }
    return error;
  }
}
