import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from './authenticated-request.interface';

export interface JwtPayload {
  sub: number;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Throws at startup if JWT_SECRET is missing, instead of failing silently.
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Runs after the signature has been verified. Whatever is returned here
  // becomes req.user for the rest of the request.
  validate(payload: JwtPayload): AuthUser {
    return { userId: payload.sub, role: payload.role };
  }
}
