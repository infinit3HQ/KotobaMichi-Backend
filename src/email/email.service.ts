import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import { render as renderVerification } from './templates/verification.template';
import { render as renderPasswordReset } from './templates/password-reset.template';

@Injectable()
export class EmailService {
	private transporter?: Transporter;
	private readonly logger = new Logger(EmailService.name);

	constructor(private readonly config: ConfigService) {}

	private getFromAddress(): string {
		return this.config.get<string>('SMTP_FROM') || 'no-reply@example.com';
	}

	private async getTransporter(): Promise<Transporter> {
		if (this.transporter) return this.transporter;

		const host = this.config.get<string>('SMTP_HOST');
		const portStr = this.config.get<string>('SMTP_PORT');
		const user = this.config.get<string>('SMTP_USER');
		const pass = this.config.get<string>('SMTP_PASS');

		// Validate port: if not provided, fall back to 587; if provided, ensure it's a number in 1..65535
		let port = 587;
		let portInvalid = false;
		if (portStr != null && portStr.trim() !== '') {
			const parsed = Number.parseInt(portStr, 10);
			if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
				portInvalid = true;
			} else {
				port = parsed;
			}
		}

		// Compute secure only after we have a validated numeric port
		const secure =
			(this.config.get<string>('SMTP_SECURE') || 'false').toLowerCase() ===
				'true' || port === 465;

		// Collect any missing or invalid config keys so we can throw a single clear error
		const missing: string[] = [];
		if (!host) missing.push('SMTP_HOST');
		if (!user) missing.push('SMTP_USER');
		if (!pass) missing.push('SMTP_PASS');
		if (portInvalid) missing.push('SMTP_PORT');

		if (missing.length > 0) {
			throw new Error(
				`SMTP configuration is missing or invalid. Please set/repair the following env vars: ${missing.join(', ')}.`
			);
		}

		// create a local transporter and verify it before caching
		const localTransporter = nodemailer.createTransport({
			host,
			port,
			secure,
			auth: { user, pass },
		});

		// verify connection
		try {
			await localTransporter.verify();
		} catch (err) {
			// include error details (message/stack) in the log and rethrow the original error
			this.logger.error(
				`SMTP transporter verification failed: ${(err as any)?.message ?? err}`,
				(err as any)?.stack ?? JSON.stringify(err)
			);
			throw err;
		}

		// only cache the transporter after successful verification
		this.transporter = localTransporter;
		return this.transporter;
	}

	async sendMail(options: {
		to: string;
		subject: string;
		html?: string;
		text?: string;
	}): Promise<void> {
		const transporter = await this.getTransporter();
		const from = this.getFromAddress();
		await transporter.sendMail({ from, ...options });
	}

	// name is optional; if provided we'll use a more personal greeting
	async sendVerificationEmail(
		to: string,
		verifyLink: string,
		name?: string
	): Promise<void> {
		const displayName = name || '';
		const subject = 'Welcome to Kotobamichi! Please Confirm Your Email';
		const { text, html } = renderVerification({
			name: displayName,
			link: verifyLink,
		});
		await this.sendMail({ to, subject, text, html });
	}

	async sendPasswordResetEmail(
		to: string,
		resetLink: string,
		name?: string
	): Promise<void> {
		const displayName = name || '';
		const subject = 'Kotobamichi — Password reset request';
		const { text, html } = renderPasswordReset({
			name: displayName,
			link: resetLink,
		});
		await this.sendMail({ to, subject, text, html });
	}
}
