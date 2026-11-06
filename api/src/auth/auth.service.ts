import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { PUBLIC_USER_SELECT } from '../users/user.select';
import { isPrismaError, UNIQUE_CONSTRAINT } from '../prisma/prisma-errors';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt.strategy';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const password = await bcrypt.hash(dto.password, SALT_ROUNDS);

    try {
      const user = await this.prisma.user.create({
        data: { email, name: dto.name, password, role: Role.PATRON },
        select: PUBLIC_USER_SELECT,
      });
      return { accessToken: this.signToken(user.id, user.role), user };
    } catch (error) {
      // Race-safe: the unique index on email is the source of truth.
      if (isPrismaError(error, UNIQUE_CONSTRAINT)) {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const found = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Same message for "no such user" and "wrong password" so the API doesn't
    // reveal which emails are registered.
    const valid = found && (await bcrypt.compare(dto.password, found.password));
    if (!found || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { password: _password, ...user } = found;
    return { accessToken: this.signToken(user.id, user.role), user };
  }

  private signToken(userId: number, role: Role): string {
    const payload: JwtPayload = { sub: userId, role };
    return this.jwt.sign(payload);
  }
}
