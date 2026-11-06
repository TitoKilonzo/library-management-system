import { Prisma } from '@prisma/client';

// Fields that are safe to return to clients. The password hash is never included.
export const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect;
