import {
	Controller,
	Post,
	Body,
	UseGuards,
	Res,
	Get,
	Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtAuthGuard } from './jwt-auth/jwt-auth.guard';
import { RolesGuard } from './roles/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { Response, Request } from 'express';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Post('register')
	async register(@Body() registerUserDto: RegisterUserDto) {
		return this.authService.register(registerUserDto);
	}

	@Post('register/admin')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('ADMIN')
	async registerAdmin(@Body() registerUserDto: RegisterUserDto) {
		return this.authService.registerAdmin(registerUserDto);
	}

	@Post('login')
	async login(
		@Body() loginUserDto: LoginUserDto,
		@Res({ passthrough: true }) res: Response
	) {
		const result = await this.authService.login(loginUserDto);
		this.authService.setAuthCookies(res, result);
		return result;
	}

	@Post('logout')
	async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		return this.authService.logoutFromCookies(req, res);
	}

	@Get('validate')
	async validate(
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response
	) {
		return this.authService.validateFromCookies(req, res);
	}

	@Post('refresh')
	async refresh(
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request
	) {
		const result = await this.authService.refreshFromCookies(req, res);
		this.authService.setAuthCookies(res, result);
		return result;
	}

	@Post('verify-email')
	async verifyEmail(@Body() body: VerifyEmailDto) {
		return this.authService.verifyEmail(body.token);
	}

	@Post('resend-verification')
	async resendVerification(@Body() dto: ResendVerificationDto) {
		return this.authService.resendVerification(dto.email);
	}

	@Post('forgot-password')
	async forgotPassword(@Body() dto: ForgotPasswordDto) {
		return this.authService.forgotPassword(dto.email);
	}

	@Post('reset-password')
	async resetPassword(@Body() dto: ResetPasswordDto) {
		return this.authService.resetPassword(dto.token, dto.newPassword);
	}

	@UseGuards(JwtAuthGuard)
	@Post('change-password')
	async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
		const userId = (req as any).user?.userId;
		return this.authService.changePassword(userId, dto.currentPassword, dto.newPassword);
	}
}
