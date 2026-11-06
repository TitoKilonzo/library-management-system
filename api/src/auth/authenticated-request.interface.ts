import { Request } from 'express';
import { Role } from '@prisma/client';

/** Shape returned by JwtStrategy.validate(); becomes req.user. */
export interface AuthUser {
  userId: number;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
