import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { DbService } from '@/db/drizzle.service';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AppService implements OnModuleInit {
	private readonly logger = new Logger(AppService.name);

	constructor(
		private readonly dbService: DbService,
		private readonly configService: ConfigService
	) {}
	private get db() {
		return this.dbService.db;
	}

	getHello(): string {
		return 'Hello World!';
	}

	async onModuleInit() {
		await this.seedInitialUsers();
	}

	private async seedInitialUsers() {
		try {
			this.logger.log('Checking for initial admin...');

			// Get credentials from environment variables
			const adminEmail =
				this.configService.get<string>('ADMIN_EMAIL') ||
				'admin@kotobamichi.com';
			const adminPassword =
				this.configService.get<string>('ADMIN_PASSWORD') || 'admin123';

			// Check if admin already exists
			const existingAdmin = await this.db.query.users.findFirst({
				where: eq(users.role, 'ADMIN'),
			});

			if (!existingAdmin) {
				// Create first admin user
				const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
				const [admin] = await this.db
					.insert(users)
					.values({
						id: uuidv7(),
						email: adminEmail,
						password: hashedAdminPassword,
						role: 'ADMIN',
					})
					.returning();
				if (admin) {
					this.logger.log(`✅ First admin user created: ${admin.email}`);
					this.logger.log(
						`📋 Admin Credentials: Email: ${adminEmail}, Password: ${adminPassword}`
					);
				}
			} else {
				this.logger.log('ℹ️  Admin already exists, skipping admin creation');
			}

			this.logger.log('🔐 Security Note:');
			this.logger.log('- Only admins can create other admin users');
			this.logger.log(
				'- Use /auth/register/admin (with admin token) to create additional admins'
			);
			this.logger.log(
				'- Normal users should register via /auth/register endpoint'
			);
		} catch (error) {
			this.logger.error('❌ Error creating initial admin:', error);
		}
	}
}
