import { Prisma } from '@prisma/client';

/** True when `error` is a Prisma "known request" error with the given code. */
export function isPrismaError(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

// Common Prisma error codes
export const UNIQUE_CONSTRAINT = 'P2002';
export const FOREIGN_KEY_CONSTRAINT = 'P2003';
export const RECORD_NOT_FOUND = 'P2025';
