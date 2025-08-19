import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

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
    const secure = (this.config.get<string>('SMTP_SECURE') || 'false').toLowerCase() === 'true' || port === 465;

    // Collect any missing or invalid config keys so we can throw a single clear error
    const missing: string[] = [];
    if (!host) missing.push('SMTP_HOST');
    if (!user) missing.push('SMTP_USER');
    if (!pass) missing.push('SMTP_PASS');
    if (portInvalid) missing.push('SMTP_PORT');

    if (missing.length > 0) {
      throw new Error(
        `SMTP configuration is missing or invalid. Please set/repair the following env vars: ${missing.join(', ')}.`,
      );
    }

    this.transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    // verify connection
    try {
      await this.transporter.verify();
    } catch (err) {
      this.logger.error('SMTP transporter verification failed', err as any);
      throw err;
    }
    return this.transporter;
  }

  async sendMail(options: { to: string; subject: string; html?: string; text?: string; }): Promise<void> {
    const transporter = await this.getTransporter();
    const from = this.getFromAddress();
    await transporter.sendMail({ from, ...options });
  }

  async sendVerificationEmail(to: string, verifyLink: string): Promise<void> {
    const subject = 'Verify your email';
    const text = `Welcome! Please verify your email by visiting this link: ${verifyLink}`;
    const html = `<p>Welcome!</p><p>Please verify your email by clicking the link below:</p><p><a href="${verifyLink}">Verify Email</a></p><p>If the button doesn't work, copy and paste this URL into your browser:<br/><code>${verifyLink}</code></p>`;
    await this.sendMail({ to, subject, text, html });
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    const subject = 'Reset your password';
    const text = `You requested a password reset. Use this link to set a new password: ${resetLink}`;
    const html = `<p>You requested a password reset.</p><p>Click the link to set a new password:</p><p><a href="${resetLink}">Reset Password</a></p><p>If the button doesn't work, copy this URL:<br/><code>${resetLink}</code></p>`;
    await this.sendMail({ to, subject, text, html });
  }
}
