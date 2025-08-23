import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  public readonly db: NodePgDatabase<typeof schema>;
  private readonly pool: Pool;

  constructor() {
  const connectionString = process.env['DATABASE_URL'];
    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined');
    }
    this.pool = new Pool({ connectionString });
    this.db = drizzle(this.pool, { schema });
  }

  async onModuleInit() {
    // Simple connectivity check
    const client = await this.pool.connect();
    client.release();
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async healthCheck(): Promise<boolean> {
    const res = await this.pool.query('SELECT 1');
    return res.rowCount === 1;
  }
}
