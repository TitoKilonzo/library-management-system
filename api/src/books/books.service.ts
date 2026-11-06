import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isPrismaError, UNIQUE_CONSTRAINT } from '../prisma/prisma-errors';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';

const MAX_LIMIT = 100;

@Injectable()
export class BooksService {
  constructor(private prisma: PrismaService) {}

  async findAll(genreId?: number, search?: string, page = 1, limit = 10) {
    // Keep pagination values sane no matter what the client sends.
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(MAX_LIMIT, Math.max(1, limit));
    const term = search?.trim();

    // Build the where clause only from the filters that were actually provided.
    const where: Prisma.BookWhereInput = {
      ...(genreId !== undefined && { genreId }),
      ...(term && {
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { author: { contains: term, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.book.findMany({
        where,
        include: { genre: true },
        orderBy: [{ title: 'asc' }, { id: 'asc' }], // stable order for paging
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.book.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async findOne(id: number) {
    const book = await this.prisma.book.findUnique({
      where: { id },
      include: { genre: true },
    });
    if (!book) throw new NotFoundException(`Book ${id} not found`);
    return book;
  }

  async create(dto: CreateBookDto) {
    await this.assertGenreExists(dto.genreId);
    try {
      return await this.prisma.book.create({
        // A brand-new book has every copy available.
        data: { ...dto, availableCopies: dto.totalCopies },
        include: { genre: true },
      });
    } catch (error) {
      throw this.translate(error, dto.isbn);
    }
  }

  async update(id: number, dto: UpdateBookDto) {
    const book = await this.findOne(id); // 404 if it doesn't exist
    if (dto.genreId !== undefined) await this.assertGenreExists(dto.genreId);

    const data: Prisma.BookUncheckedUpdateInput = { ...dto };

    // Changing totalCopies shifts availableCopies by the same amount, so copies
    // that are currently on loan stay accounted for.
    if (dto.totalCopies !== undefined) {
      const available =
        book.availableCopies + (dto.totalCopies - book.totalCopies);
      if (available < 0) {
        throw new BadRequestException(
          `totalCopies cannot be lower than the ${book.totalCopies - book.availableCopies} copies currently on loan`,
        );
      }
      data.availableCopies = available;
    }

    try {
      return await this.prisma.book.update({
        where: { id },
        data,
        include: { genre: true },
      });
    } catch (error) {
      throw this.translate(error, dto.isbn);
    }
  }

  async remove(id: number) {
    await this.findOne(id); // 404 if it doesn't exist
    // Reviews are removed automatically (onDelete: Cascade in the schema).
    return this.prisma.book.delete({ where: { id } });
  }

  private async assertGenreExists(genreId: number) {
    const genre = await this.prisma.genre.findUnique({ where: { id: genreId } });
    if (!genre) throw new BadRequestException(`Genre ${genreId} does not exist`);
  }

  private translate(error: unknown, isbn?: string): unknown {
    if (isPrismaError(error, UNIQUE_CONSTRAINT)) {
      return new ConflictException(
        `A book with ISBN ${isbn ?? 'this value'} already exists`,
      );
    }
    return error;
  }
}
