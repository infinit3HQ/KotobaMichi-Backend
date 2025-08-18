import {
	Injectable,
	UnauthorizedException,
	ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import * as bcrypt from 'bcrypt';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { createHash, timingSafeEqual } from 'node:crypto';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
	constructor(
		private prisma: PrismaService,
		private jwtService: JwtService,
		private config: ConfigService,
		private emailService: EmailService
	) {}

	private getCookieOptions() {
		const isProd =
			(process.env['NODE_ENV'] || '').toLowerCase() === 'production';
		const secure =
			(process.env['COOKIE_SECURE'] || '').toLowerCase() === 'true' || isProd;
		const sameSiteEnv = (process.env['COOKIE_SAMESITE'] ||
			(secure ? 'none' : 'lax')) as 'lax' | 'strict' | 'none';
		return {
			httpOnly: true,
			secure,
			sameSite: sameSiteEnv,
			path: '/',
		} as const;
	}

	private accessTokenTTL(): string {
		return this.config.get<string>('ACCESS_TOKEN_EXPIRES_IN') || '15m';
	}

	private refreshTokenTTL(): string {
		return this.config.get<string>('REFRESH_TOKEN_EXPIRES_IN') || '7d';
	}

	private signAccessToken(user: { id: string; email: string; role: string }) {
		const payload = {
			email: user.email,
			sub: user.id,
			role: user.role,
			type: 'access',
		} as const;
		return this.jwtService.sign(payload, { expiresIn: this.accessTokenTTL() });
	}

	private signRefreshToken(user: { id: string }) {
		const jti = uuidv4();
		const payload = { sub: user.id, jti, type: 'refresh' } as const;
		const token = this.jwtService.sign(payload, {
			expiresIn: this.refreshTokenTTL(),
		});
		return { token, jti } as const;
	}

	setAuthCookies(
		res: Response,
		tokens: { access_token: string; refresh_token: string }
	) {
		const opts = this.getCookieOptions();
		// Access token cookie: short-lived
		res.cookie('access_token', tokens.access_token, {
			...opts,
			maxAge: this.parseTTLToMs(this.accessTokenTTL()),
		});
		// Refresh token cookie: longer-lived
		res.cookie('refresh_token', tokens.refresh_token, {
			...opts,
			maxAge: this.parseTTLToMs(this.refreshTokenTTL()),
		});
	}

	clearAuthCookies(res: Response) {
		const opts = this.getCookieOptions();
		res.clearCookie('access_token', { ...opts, maxAge: 0 });
		res.clearCookie('refresh_token', { ...opts, maxAge: 0 });
	}

	private parseTTLToMs(ttl: string): number {
		// Supports formats like '15m', '7d', '3600s'
		const m = ttl.match(/^(\d+)(s|m|h|d)$/i);
		if (!m) return 0; // browser session cookie
		const value = parseInt(m[1] as string, 10);
		const unit = (m[2] as string).toLowerCase();
		switch (unit) {
			case 's':
				return value * 1000;
			case 'm':
				return value * 60 * 1000;
			case 'h':
				return value * 60 * 60 * 1000;
			case 'd':
				return value * 24 * 60 * 60 * 1000;
			default:
				return 0;
		}
	}

	private hashToken(token: string): string {
		// Use Node's built-in crypto for SHA-256 hashing (maintained and fast)
		return createHash('sha256').update(token).digest('hex');
	}

	private addMs(date: Date, ms: number) {
		return new Date(date.getTime() + ms);
	}

	async register(registerUserDto: RegisterUserDto) {
		const { email, password } = registerUserDto;

		// Check if user already exists
		const existingUser = await this.prisma.user.findUnique({
			where: { email },
		});

		if (existingUser) {
			throw new ConflictException('User with this email already exists');
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(password, 10);

		// Create user
		const user = await this.prisma.user.create({
			data: {
				email,
				password: hashedPassword,
				role: 'USER',
			},
		});

		// create verification token and send email
		await this.issueAndSendEmailVerification(user.id, user.email);


		// For security, we don't auto-login until email verified
		return {
			message: 'Registration successful. Please verify your email to log in.' as const,
		};
	}

	async registerAdmin(registerUserDto: RegisterUserDto) {
		const { email, password } = registerUserDto;

		// Check if user already exists
		const existingUser = await this.prisma.user.findUnique({
			where: { email },
		});

		if (existingUser) {
			throw new ConflictException('User with this email already exists');
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(password, 10);

		// Create admin user
		const user = await this.prisma.user.create({
			data: {
				email,
				password: hashedPassword,
				role: 'ADMIN',
			},
		});

		// Generate tokens
		const access = this.signAccessToken(user);
		const { token: refresh, jti } = this.signRefreshToken(user);

		// Persist refresh token
		await this.prisma.refreshToken.create({
			data: {
				jti,
				userId: user.id,
				tokenHash: this.hashToken(refresh),
				expiresAt: this.addMs(
					new Date(),
					this.parseTTLToMs(this.refreshTokenTTL())
				),
			},
		});

		return {
			access_token: access,
			refresh_token: refresh,
			user: {
				id: user.id,
				email: user.email,
				role: user.role,
			},
		};
	}

	async login(loginUserDto: LoginUserDto) {
		const { email, password } = loginUserDto;

		// Find user
		const user = await this.prisma.user.findUnique({
			where: { email },
		});

		if (!user) {
			throw new UnauthorizedException('Invalid credentials');
		}

		// Verify password
		const isPasswordValid = await bcrypt.compare(password, user.password);
		if (!isPasswordValid) {
			throw new UnauthorizedException('Invalid credentials');
		}

		if (!user.isEmailVerified) {
			throw new UnauthorizedException('Email not verified');
		}

		// Generate tokens
		const access = this.signAccessToken(user);
		const { token: refresh, jti } = this.signRefreshToken(user);

		// Persist refresh token
		await this.prisma.refreshToken.create({
			data: {
				jti,
				userId: user.id,
				tokenHash: this.hashToken(refresh),
				expiresAt: this.addMs(
					new Date(),
					this.parseTTLToMs(this.refreshTokenTTL())
				),
			},
		});

		return {
			access_token: access,
			refresh_token: refresh,
			user: {
				id: user.id,
				email: user.email,
				role: user.role,
			},
		};
	}

	private verificationTokenTTL(): string {
		return this.config.get<string>('EMAIL_VERIFICATION_EXPIRES_IN') || '1d';
	}

	private buildVerificationLink(token: string): string {
		const base = this.config.get<string>('APP_URL') || 'http://localhost:3000';
		// The frontend should have a route like /verify-email?token=...
		return `${base.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(
			token
		)}`;
	}

	private passwordResetTTL(): string {
		return this.config.get<string>('PASSWORD_RESET_EXPIRES_IN') || '1h';
	}

	private buildPasswordResetLink(token: string): string {
		const base = this.config.get<string>('APP_URL') || 'http://localhost:3000';
		return `${base.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(
			token
		)}`;
	}

	private async issueAndSendEmailVerification(userId: string, email: string) {
		// Invalidate previous tokens
		await this.prisma.emailVerificationToken.updateMany({
			where: { userId, usedAt: null },
			data: { usedAt: new Date() },
		});
		const raw = uuidv4() + '.' + uuidv4(); // long random string
		const tokenHash = this.hashToken(raw);
		const expiresAt = this.addMs(new Date(), this.parseTTLToMs(this.verificationTokenTTL()));
		await this.prisma.emailVerificationToken.create({
			data: { userId, tokenHash, expiresAt },
		});
		const link = this.buildVerificationLink(raw);
		await this.emailService.sendVerificationEmail(email, link);
	}

	async verifyEmail(token: string) {
		const tokenHash = this.hashToken(token);
		const rec = await this.prisma.emailVerificationToken.findUnique({
			where: { tokenHash },
		});
		if (!rec || rec.usedAt || rec.expiresAt.getTime() < Date.now()) {
			throw new UnauthorizedException('Invalid or expired token');
		}
		await this.prisma.$transaction([
			this.prisma.user.update({
				where: { id: rec.userId },
				data: { isEmailVerified: true },
			}),
			this.prisma.emailVerificationToken.update({
				where: { tokenHash },
				data: { usedAt: new Date() },
			}),
		]);
		return { success: true } as const;
	}

	async resendVerification(email: string) {
		const user = await this.prisma.user.findUnique({ where: { email } });
		if (!user) return { success: true } as const; // do not reveal users
		if (user.isEmailVerified) return { success: true } as const;
		await this.issueAndSendEmailVerification(user.id, user.email);
		return { success: true } as const;
	}

	async forgotPassword(email: string) {
		const user = await this.prisma.user.findUnique({ where: { email } });
		if (!user) return { success: true } as const; // do not reveal existence
		// Invalidate previous tokens
		await this.prisma.passwordResetToken.updateMany({
			where: { userId: user.id, usedAt: null },
			data: { usedAt: new Date() },
		});
		const raw = uuidv4() + '.' + uuidv4();
		const tokenHash = this.hashToken(raw);
		const expiresAt = this.addMs(
			new Date(),
			this.parseTTLToMs(this.passwordResetTTL())
		);
		await this.prisma.passwordResetToken.create({
			data: { userId: user.id, tokenHash, expiresAt },
		});
		const link = this.buildPasswordResetLink(raw);
		await this.emailService.sendPasswordResetEmail(email, link);
		return { success: true } as const;
	}

	async resetPassword(token: string, newPassword: string) {
		const tokenHash = this.hashToken(token);
		const rec = await this.prisma.passwordResetToken.findUnique({
			where: { tokenHash },
		});
		if (!rec || rec.usedAt || rec.expiresAt.getTime() < Date.now()) {
			throw new UnauthorizedException('Invalid or expired token');
		}
		const hashed = await bcrypt.hash(newPassword, 10);
		await this.prisma.$transaction([
			this.prisma.user.update({
				where: { id: rec.userId },
				data: { password: hashed },
			}),
			this.prisma.passwordResetToken.update({
				where: { tokenHash },
				data: { usedAt: new Date() },
			}),
			// Revoke all refresh tokens to log out from all devices
			this.prisma.refreshToken.updateMany({
				where: { userId: rec.userId, revokedAt: null },
				data: { revokedAt: new Date() },
			}),
		]);
		return { success: true } as const;
	}

	async changePassword(
		userId: string,
		currentPassword: string,
		newPassword: string
	) {
		const user = await this.prisma.user.findUnique({ where: { id: userId } });
		if (!user) throw new UnauthorizedException('User not found');
		const ok = await bcrypt.compare(currentPassword, user.password);
		if (!ok) throw new UnauthorizedException('Current password incorrect');
		const hashed = await bcrypt.hash(newPassword, 10);
		await this.prisma.$transaction([
			this.prisma.user.update({ where: { id: userId }, data: { password: hashed } }),
			this.prisma.refreshToken.updateMany({
				where: { userId, revokedAt: null },
				data: { revokedAt: new Date() },
			}),
		]);
		return { success: true } as const;
	}

	async refreshFromCookies(req?: Request, res?: Response) {
		if (!req) {
			throw new UnauthorizedException('No request context');
		}
		const token = req.cookies?.['refresh_token'];
		if (!token) {
			throw new UnauthorizedException('Refresh token missing');
		}

		let payload: any;
		try {
			payload = await this.jwtService.verifyAsync(token);
		} catch {
			// Possible reuse; if we can parse jti, revoke the family
			try {
				const decoded = this.jwtService.decode(token) as any;
				if (decoded?.jti) {
					await this.revokeRefreshTokenFamily(decoded.jti);
				}
			} catch {}
			this.clearAuthCookies(res!);
			throw new UnauthorizedException('Invalid refresh token');
		}
		if (payload?.type !== 'refresh' || !payload?.sub || !payload?.jti) {
			this.clearAuthCookies(res!);
			throw new UnauthorizedException('Invalid refresh token');
		}

		// Check DB record for jti and hash match
		const rt = await this.prisma.refreshToken.findUnique({
			where: { jti: payload.jti },
		});
		const user = await this.prisma.user.findUnique({
			where: { id: payload.sub },
		});
		if (!user) {
			await this.revokeRefreshTokenFamily(payload.jti).catch(() => {});
			this.clearAuthCookies(res!);
			throw new UnauthorizedException('User not found');
		}
		// Constant-time hash comparison to prevent timing side-channels
		let matchHash = false;
		if (rt) {
			const calc = this.hashToken(token);
			const a = Buffer.from(rt.tokenHash, 'hex');
			const b = Buffer.from(calc, 'hex');
			if (a.length === b.length) {
				try {
					matchHash = timingSafeEqual(a, b);
				} catch {}
			}
		}
		const isExpired = rt ? rt.expiresAt.getTime() < Date.now() : true;
		if (!rt || rt.revokedAt || !matchHash || isExpired) {
			// Reuse detection: revoke all user's tokens
			await this.revokeAllUserRefreshTokens(user.id).catch(() => {});
			this.clearAuthCookies(res!);
			throw new UnauthorizedException('Refresh token revoked or invalid');
		}

		// Rotate: create new refresh token, revoke old
		const { token: newRefresh, jti: newJti } = this.signRefreshToken(user);
		const newRecord = await this.prisma.refreshToken.create({
			data: {
				jti: newJti,
				userId: user.id,
				tokenHash: this.hashToken(newRefresh),
				expiresAt: this.addMs(
					new Date(),
					this.parseTTLToMs(this.refreshTokenTTL())
				),
			},
		});
		await this.prisma.refreshToken.update({
			where: { jti: payload.jti },
			data: { revokedAt: new Date(), replacedById: newRecord.id },
		});

		const access = this.signAccessToken(user);
		const refresh = newRefresh;
		return {
			access_token: access,
			refresh_token: refresh,
			user: {
				id: user.id,
				email: user.email,
				role: user.role,
			},
		};
	}

	async validateFromCookies(req: Request, res: Response) {
		const token = req.cookies?.['access_token'];
		if (!token) {
			this.clearAuthCookies(res);
			throw new UnauthorizedException('No access token');
		}
		try {
			const payload: any = await this.jwtService.verifyAsync(token);
			if (payload?.type !== 'access') {
				this.clearAuthCookies(res);
				throw new UnauthorizedException('Invalid access token');
			}
			// Fetch and return user for better UX
			const user = await this.prisma.user.findUnique({
				where: { id: payload.sub },
			});
			if (!user) {
				this.clearAuthCookies(res);
				throw new UnauthorizedException('User not found');
			}
			return {
				valid: true,
				user: {
					id: user.id,
					email: user.email,
					role: user.role,
				},
			} as const;
		} catch {
			this.clearAuthCookies(res);
			throw new UnauthorizedException('Access token expired');
		}
	}

	private async revokeRefreshTokenFamily(jti: string) {
		// Revoke the token with this jti and any that directly replace it (simple chain); also safe-guard by revoking all tokens created earlier for same user via subquery
		const existing = await this.prisma.refreshToken.findUnique({
			where: { jti },
		});
		if (!existing) return;
		await this.revokeAllUserRefreshTokens(existing.userId);
	}

	private async revokeAllUserRefreshTokens(userId: string) {
		await this.prisma.refreshToken.updateMany({
			where: { userId, revokedAt: null },
			data: { revokedAt: new Date() },
		});
	}

	async logoutFromCookies(req: Request, res: Response) {
		const rt = req.cookies?.['refresh_token'];
		if (rt) {
			try {
				const payload: any = this.jwtService.decode(rt);
				if (payload?.sub) {
					await this.revokeAllUserRefreshTokens(payload.sub);
				}
			} catch {}
		}
		this.clearAuthCookies(res);
		return { success: true } as const;
	}
}
