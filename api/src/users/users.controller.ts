import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  // Stretch: GET /users/profile. Any logged-in user (PATRON or LIBRARIAN).
  // @Req() gives access to req.user, which JwtStrategy.validate() populated.
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.usersService.findProfile(req.user.userId);
  }
}
