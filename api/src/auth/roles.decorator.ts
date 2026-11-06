import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

// Attaches metadata only; RolesGuard reads it back with the Reflector.
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
