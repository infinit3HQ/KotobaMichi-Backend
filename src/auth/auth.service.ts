import {
	Injectable,
	UnauthorizedException,
	ConflictException,
	Logger,
	HttpException,
	HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DbService } from '@/db/drizzle.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import * as bcrypt from 'bcrypt';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { v7 as uuidv7 } from 'uuid';
import { createHash, timingSafeEqual } from 'node:crypto';
import { EmailService } from '../email/email.service';
import {
	users,
	refreshTokens,
	emailVerificationTokens,
	passwordResetTokens,
} from '@/db/schema';
import { eq, and, sql, desc, gte, isNull } from 'drizzle-orm';

@Injectable()
export class AuthService {
	constructor(
		private dbService: DbService,
		private jwtService: JwtService,
		private config: ConfigService,
		private emailService: EmailService
	) {}

	private readonly logger = new Logger(AuthService.name);
	private get db() {
		return this.dbService.db;
	}

	// ===== Utility helpers =====
	private makeId() {
		return uuidv7();
	}

	private async getUserByEmail(email: string) {
		const rows = await this.db
			.select()
			.from(users)
			.where(eq(users.email, email))
			.limit(1);
		return rows[0] || null;
	}

	private async getUserById(id: string) {
		const rows = await this.db
			.select()
			.from(users)
			.where(eq(users.id, id))
			.limit(1);
		return rows[0] || null;
	}

	private async getLatestEmailVerificationToken(userId: string) {
		const rows = await this.db
			.select()
			.from(emailVerificationTokens)
			.where(eq(emailVerificationTokens.userId, userId))
			.orderBy(desc(emailVerificationTokens.createdAt))
			.limit(1);
		return rows[0] || null;
	}

	private async getLatestPasswordResetToken(userId: string) {
		const rows = await this.db
			.select()
			.from(passwordResetTokens)
			.where(eq(passwordResetTokens.userId, userId))
			.orderBy(desc(passwordResetTokens.createdAt))
			.limit(1);
		return rows[0] || null;
	}

	private async getEmailVerificationTokenByHash(hash: string) {
		const rows = await this.db
			.select()
			.from(emailVerificationTokens)
			.where(eq(emailVerificationTokens.tokenHash, hash))
			.limit(1);
		return rows[0] || null;
	}

	private async getPasswordResetTokenByHash(hash: string) {
		const rows = await this.db
			.select()
			.from(passwordResetTokens)
			.where(eq(passwordResetTokens.tokenHash, hash))
			.limit(1);
		return rows[0] || null;
	}

	private async getRefreshTokenByJti(jti: string) {
		const rows = await this.db
			.select()
			.from(refreshTokens)
			.where(eq(refreshTokens.jti, jti))
			.limit(1);
		return rows[0] || null;
	}

	// ===== Rate-limit helpers for email sends =====
	private verificationCooldownSeconds(): number {
		const v = this.config.get<string>('EMAIL_VERIFICATION_COOLDOWN_SECONDS');
		return v ? Math.max(0, parseInt(v, 10)) : 60; // default 60s
	}

	private verificationDailyLimit(): number {
		const v = this.config.get<string>('EMAIL_VERIFICATION_DAILY_LIMIT');
		return v ? Math.max(1, parseInt(v, 10)) : 10; // default 10/day
	}

	private resetCooldownSeconds(): number {
		const v = this.config.get<string>('PASSWORD_RESET_COOLDOWN_SECONDS');
		return v ? Math.max(0, parseInt(v, 10)) : 60; // default 60s
	}

	private resetDailyLimit(): number {
		const v = this.config.get<string>('PASSWORD_RESET_DAILY_LIMIT');
		return v ? Math.max(1, parseInt(v, 10)) : 10; // default 10/day
	}

	private formatWait(ms: number) {
		const sec = Math.ceil(ms / 1000);
		return `${sec}s`;
	}

	private async enforceVerificationRateLimit(userId: string) {
		const cooldownMs = this.verificationCooldownSeconds() * 1000;
		const now = Date.now();
		const last = await this.getLatestEmailVerificationToken(userId);
		if (last) {
			const elapsed = now - last.createdAt.getTime();
			if (elapsed < cooldownMs) {
				const wait = this.formatWait(cooldownMs - elapsed);
				throw new HttpException(
					`Please wait ${wait} before requesting another verification email.`,
					HttpStatus.TOO_MANY_REQUESTS
				);
			}
		}
		const since = new Date(now - 24 * 60 * 60 * 1000);
		const [dailyRow] = await this.db
			.select({ value: sql<number>`count(*)` })
			.from(emailVerificationTokens)
			.where(
				and(
					eq(emailVerificationTokens.userId, userId),
					gte(emailVerificationTokens.createdAt, since)
				)
			);
		const dailyCount = Number(dailyRow?.value || 0);
		if (dailyCount >= this.verificationDailyLimit()) {
			throw new HttpException(
				'Daily limit for verification emails reached. Try again later.',
				HttpStatus.TOO_MANY_REQUESTS
			);
		}
	}

	private async enforcePasswordResetRateLimit(userId: string) {
		const cooldownMs = this.resetCooldownSeconds() * 1000;
		const now = Date.now();
		const last = await this.getLatestPasswordResetToken(userId);
		if (last) {
			const elapsed = now - last.createdAt.getTime();
			if (elapsed < cooldownMs) {
				const wait = this.formatWait(cooldownMs - elapsed);
				throw new HttpException(
					`Please wait ${wait} before requesting another password reset email.`,
					HttpStatus.TOO_MANY_REQUESTS
				);
			}
		}
		const since = new Date(now - 24 * 60 * 60 * 1000);
		const [dailyRow] = await this.db
			.select({ value: sql<number>`count(*)` })
			.from(passwordResetTokens)
			.where(
				and(
					eq(passwordResetTokens.userId, userId),
					gte(passwordResetTokens.createdAt, since)
				)
			);
		const dailyCount = Number(dailyRow?.value || 0);
		if (dailyCount >= this.resetDailyLimit()) {
			throw new HttpException(
				'Daily limit for password reset emails reached. Try again later.',
				HttpStatus.TOO_MANY_REQUESTS
			);
		}
	}

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
		const jti = uuidv7();
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
		const existingUser = await this.getUserByEmail(email);

		if (existingUser) {
			this.logger.warn(`Registration attempt with existing email: ${email}`);
			throw new ConflictException('User with this email already exists');
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(password, 10);

		// Create user
		const [user] = await this.db
			.insert(users)
			.values({
				id: this.makeId(),
				email,
				password: hashedPassword,
				role: 'USER',
			})
			.returning();
		if (!user) throw new Error('Failed to create user');

		// create verification token and send email
		await this.issueAndSendEmailVerification(user.id, user.email);
		this.logger.log(`User registered and verification email queued: ${email}`);

		// For security, we don't auto-login until email verified
		return {
			message:
				'Registration successful. Please verify your email to log in.' as const,
		};
	}

	async registerAdmin(registerUserDto: RegisterUserDto) {
		const { email, password } = registerUserDto;

		// Check if user already exists
		const existingUser = await this.getUserByEmail(email);

		if (existingUser) {
			this.logger.warn(
				`Admin registration attempt with existing email: ${email}`
			);
			throw new ConflictException('User with this email already exists');
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(password, 10);

		// Create admin user
		const [user] = await this.db
			.insert(users)
			.values({
				id: this.makeId(),
				email,
				password: hashedPassword,
				role: 'ADMIN',
			})
			.returning();
		if (!user) throw new Error('Failed to create admin user');

		// Generate tokens
		const access = this.signAccessToken(user);
		const { token: refresh, jti } = this.signRefreshToken(user);

		// Persist refresh token
		await this.db.insert(refreshTokens).values({
			id: this.makeId(),
			jti,
			userId: user.id,
			tokenHash: this.hashToken(refresh),
			expiresAt: this.addMs(
				new Date(),
				this.parseTTLToMs(this.refreshTokenTTL())
			),
		});

		this.logger.log(`Admin user registered: ${user.email}`);
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
		const user = await this.getUserByEmail(email);

		if (!user) {
			this.logger.warn(`Login failed (no user): ${email}`);
			throw new UnauthorizedException('Invalid credentials');
		}

		// Verify password
		const isPasswordValid = await bcrypt.compare(password, user.password);
		if (!isPasswordValid) {
			this.logger.warn(`Login failed (bad password): ${email}`);
			throw new UnauthorizedException('Invalid credentials');
		}

		if (!user.isEmailVerified) {
			this.logger.warn(`Login blocked, email not verified: ${email}`);
			throw new UnauthorizedException('Email not verified');
		}

		// Generate tokens
		const access = this.signAccessToken(user);
		const { token: refresh, jti } = this.signRefreshToken(user);

		// Persist refresh token
		await this.db.insert(refreshTokens).values({
			id: this.makeId(),
			jti,
			userId: user.id,
			tokenHash: this.hashToken(refresh),
			expiresAt: this.addMs(
				new Date(),
				this.parseTTLToMs(this.refreshTokenTTL())
			),
		});

		this.logger.log(`User logged in: ${email}`);
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
		try {
			// Invalidate previous tokens
			await this.db
				.update(emailVerificationTokens)
				.set({ usedAt: new Date() })
				.where(
					and(
						eq(emailVerificationTokens.userId, userId),
						isNull(emailVerificationTokens.usedAt)
					)
				);
			const raw = uuidv7() + '.' + uuidv7(); // long random string
			const tokenHash = this.hashToken(raw);
			const expiresAt = this.addMs(
				new Date(),
				this.parseTTLToMs(this.verificationTokenTTL())
			);
			await this.db
				.insert(emailVerificationTokens)
				.values({ id: this.makeId(), userId, tokenHash, expiresAt });
			const link = this.buildVerificationLink(raw);
			const displayName = email.split('@')[0];
			await this.emailService.sendVerificationEmail(email, link, displayName);
			this.logger.log(`Verification email sent to: ${email}`);
		} catch (err: any) {
			this.logger.error(
				`Failed to issue/send verification email for userId=${userId}`,
				err?.stack || String(err)
			);
			throw err;
		}
	}

	async verifyEmail(token: string) {
		const tokenHash = this.hashToken(token);
		const rec = await this.getEmailVerificationTokenByHash(tokenHash);
		if (!rec || rec.usedAt || rec.expiresAt.getTime() < Date.now()) {
			this.logger.warn('Email verification failed: invalid or expired token');
			throw new UnauthorizedException('Invalid or expired token');
		}
		await this.db.transaction(async tx => {
			await tx
				.update(users)
				.set({ isEmailVerified: true })
				.where(eq(users.id, rec.userId));
			await tx
				.update(emailVerificationTokens)
				.set({ usedAt: new Date() })
				.where(eq(emailVerificationTokens.tokenHash, tokenHash));
		});
		this.logger.log(`Email verified for userId=${rec.userId}`);
		return { success: true } as const;
	}

	async resendVerification(email: string) {
		const user = await this.getUserByEmail(email);
		if (!user) {
			this.logger.debug(
				`Resend verification requested for non-existing email: ${email}`
			);
			return { success: true } as const; // do not reveal users
		}
		if (user.isEmailVerified) {
			this.logger.debug(
				`Resend verification skipped; already verified: ${email}`
			);
			return { success: true } as const;
		}
		// Per-user rate limiting (cooldown + daily cap)
		await this.enforceVerificationRateLimit(user.id);
		await this.issueAndSendEmailVerification(user.id, user.email);
		this.logger.log(`Resent verification email to: ${email}`);
		return { success: true } as const;
	}

	async forgotPassword(email: string) {
		const user = await this.getUserByEmail(email);
		if (!user) {
			this.logger.debug(
				`Forgot password requested for non-existing email: ${email}`
			);
			return { success: true } as const; // do not reveal existence
		}
		// Per-user rate limiting (cooldown + daily cap)
		await this.enforcePasswordResetRateLimit(user.id);
		// Invalidate previous tokens
		await this.db
			.update(passwordResetTokens)
			.set({ usedAt: new Date() })
			.where(
				and(
					eq(passwordResetTokens.userId, user.id),
					isNull(passwordResetTokens.usedAt)
				)
			);
		const raw = uuidv7() + '.' + uuidv7();
		const tokenHash = this.hashToken(raw);
		const expiresAt = this.addMs(
			new Date(),
			this.parseTTLToMs(this.passwordResetTTL())
		);
		await this.db
			.insert(passwordResetTokens)
			.values({ id: this.makeId(), userId: user.id, tokenHash, expiresAt });
		const link = this.buildPasswordResetLink(raw);
		const displayName = email.split('@')[0];
		await this.emailService.sendPasswordResetEmail(email, link, displayName);
		this.logger.log(`Password reset email sent to: ${email}`);
		return { success: true } as const;
	}

	async resetPassword(token: string, newPassword: string) {
		const tokenHash = this.hashToken(token);
		const rec = await this.getPasswordResetTokenByHash(tokenHash);
		if (!rec || rec.usedAt || rec.expiresAt.getTime() < Date.now()) {
			this.logger.warn('Password reset failed: invalid or expired token');
			throw new UnauthorizedException('Invalid or expired token');
		}
		const hashed = await bcrypt.hash(newPassword, 10);
		await this.db.transaction(async tx => {
			await tx
				.update(users)
				.set({ password: hashed })
				.where(eq(users.id, rec.userId));
			await tx
				.update(passwordResetTokens)
				.set({ usedAt: new Date() })
				.where(eq(passwordResetTokens.tokenHash, tokenHash));
			await tx
				.update(refreshTokens)
				.set({ revokedAt: new Date() })
				.where(
					and(
						eq(refreshTokens.userId, rec.userId),
						isNull(refreshTokens.revokedAt)
					)
				);
		});
		this.logger.log(`Password reset successful for userId=${rec.userId}`);
		return { success: true } as const;
	}

	async changePassword(
		userId: string,
		currentPassword: string,
		newPassword: string
	) {
		const user = await this.getUserById(userId);
		if (!user) {
			this.logger.warn(`Change password failed: user not found (${userId})`);
			throw new UnauthorizedException('User not found');
		}
		const ok = await bcrypt.compare(currentPassword, user.password);
		if (!ok) {
			this.logger.warn(
				`Change password failed: incorrect current password (${user.email})`
			);
			throw new UnauthorizedException('Current password incorrect');
		}
		const hashed = await bcrypt.hash(newPassword, 10);
		await this.db.transaction(async tx => {
			await tx
				.update(users)
				.set({ password: hashed })
				.where(eq(users.id, userId));
			await tx
				.update(refreshTokens)
				.set({ revokedAt: new Date() })
				.where(
					and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt))
				);
		});
		this.logger.log(
			`Password changed and sessions revoked for userId=${userId}`
		);
		return { success: true } as const;
	}

	async refreshFromCookies(req?: Request, res?: Response) {
		if (!req) {
			this.logger.error('Refresh token flow failed: no request context');
			throw new UnauthorizedException('No request context');
		}
		const token = req.cookies?.['refresh_token'];
		if (!token) {
			this.logger.warn('Refresh token missing in cookies');
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
			this.logger.warn('Refresh token verification failed; tokens cleared');
			throw new UnauthorizedException('Invalid refresh token');
		}
		if (payload?.type !== 'refresh' || !payload?.sub || !payload?.jti) {
			this.clearAuthCookies(res!);
			this.logger.warn('Refresh token payload invalid');
			throw new UnauthorizedException('Invalid refresh token');
		}

		// Check DB record for jti and hash match
		const rt = await this.getRefreshTokenByJti(payload.jti);
		const user = await this.getUserById(payload.sub);
		if (!user) {
			await this.revokeRefreshTokenFamily(payload.jti).catch(() => {});
			this.clearAuthCookies(res!);
			this.logger.warn(`Refresh failed: user not found (sub=${payload.sub})`);
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
			this.logger.warn(
				`Refresh token invalid/revoked/expired for userId=${user.id}`
			);
			throw new UnauthorizedException('Refresh token revoked or invalid');
		}

		// Rotate: create new refresh token, revoke old
		const { token: newRefresh, jti: newJti } = this.signRefreshToken(user);
		await this.db.transaction(async tx => {
			const [nr] = await tx
				.insert(refreshTokens)
				.values({
					id: this.makeId(),
					jti: newJti,
					userId: user.id,
					tokenHash: this.hashToken(newRefresh),
					expiresAt: this.addMs(
						new Date(),
						this.parseTTLToMs(this.refreshTokenTTL())
					),
				})
				.returning();
			await tx
				.update(refreshTokens)
				.set({ revokedAt: new Date(), replacedById: nr?.id })
				.where(eq(refreshTokens.jti, payload.jti));
		});

		const access = this.signAccessToken(user);
		const refresh = newRefresh;
		this.logger.log(`Refresh token rotated for userId=${user.id}`);
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
			this.logger.warn('Access token missing in cookies');
			throw new UnauthorizedException('No access token');
		}
		try {
			const payload: any = await this.jwtService.verifyAsync(token);
			if (payload?.type !== 'access') {
				this.clearAuthCookies(res);
				this.logger.warn('Invalid access token type');
				throw new UnauthorizedException('Invalid access token');
			}
			// Fetch and return user for better UX
			const user = await this.getUserById(payload.sub);
			if (!user) {
				this.clearAuthCookies(res);
				this.logger.warn(
					`Access token valid but user missing (sub=${payload.sub})`
				);
				throw new UnauthorizedException('User not found');
			}
			this.logger.debug(`Access token validated for userId=${user.id}`);
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
			this.logger.warn('Access token verification failed or expired');
			throw new UnauthorizedException('Access token expired');
		}
	}

	private async revokeRefreshTokenFamily(jti: string) {
		// Revoke the token with this jti and any that directly replace it (simple chain); also safe-guard by revoking all tokens created earlier for same user via subquery
		const existing = await this.getRefreshTokenByJti(jti);
		if (!existing) return;
		await this.revokeAllUserRefreshTokens(existing.userId);
	}

	private async revokeAllUserRefreshTokens(userId: string) {
		await this.db
			.update(refreshTokens)
			.set({ revokedAt: new Date() })
			.where(
				and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt))
			);
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
		this.logger.log(
			'User logged out (cookies cleared and refresh tokens revoked if present)'
		);
		return { success: true } as const;
	}
}
