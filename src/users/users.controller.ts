import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '@/auth/jwt-auth/jwt-auth.guard';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getProfile(@Req() req: AuthenticatedRequest) {
    return this.usersService.getUserProfile(req.user.userId);
  }

  @Get('me/attempts')
  async getMyAttempts(
    @Req() req: AuthenticatedRequest,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    
    return this.usersService.getUserQuizAttempts(
      req.user.userId,
      pageNum,
      limitNum,
    );
  }

  @Get('me/stats')
  async getMyStats(@Req() req: AuthenticatedRequest) {
    return this.usersService.getUserStats(req.user.userId);
  }
}
