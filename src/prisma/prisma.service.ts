import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
	async onModuleInit() {
		await this.$connect();
	}

	async enableShutdownHooks(app: INestApplication) {
		process.on('beforeExit', async () => {
			await app.close();
		});
	}

	/**
	 * Exclude fields from a given object
	 *
	 * @param      {T}             object  The object
	 * @param      {Key[]}         keys    The keys
	 * @return     {Omit<T, Key>}
	 */
	excludeFields<T, Key extends keyof T>(
		object: T,
		...keys: Key[]
	): Omit<T, Key> {
		for (const key of keys) {
			delete object[key];
		}
		return object;
	}
}
