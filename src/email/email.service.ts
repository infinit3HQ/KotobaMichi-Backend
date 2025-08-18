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
    const port = parseInt(this.config.get<string>('SMTP_PORT') || '587', 10);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const secure = (this.config.get<string>('SMTP_SECURE') || 'false').toLowerCase() === 'true' || port === 465;

    if (!host || !user || !pass) {
      throw new Error('SMTP configuration is missing. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.');
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
