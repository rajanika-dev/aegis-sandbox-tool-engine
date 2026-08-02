import { Controller, Get } from '@nestjs/common';
import Redis from 'ioredis';
import postgres from 'postgres';

@Controller('health')
export class HealthController {
  @Get()
  async check() {
    const databaseUrl = process.env.DATABASE_URL;
    const redisUrl = process.env.REDIS_URL;

    if (!databaseUrl || !redisUrl) {
      return {
        api: 'ok',
        postgres: databaseUrl ? 'configured' : 'missing DATABASE_URL',
        redis: redisUrl ? 'configured' : 'missing REDIS_URL',
      };
    }

    const sql = postgres(databaseUrl, { max: 1 });
    const redis = new Redis(redisUrl);

    try {
      const dbResult = await sql`select 1 as ok`;
      const redisResult = await redis.ping();

      return {
        api: 'ok',
        postgres: dbResult[0]?.ok === 1 ? 'ok' : 'unknown',
        redis: redisResult === 'PONG' ? 'ok' : redisResult,
      };
    } finally {
      await sql.end();
      redis.disconnect();
    }
  }
}
