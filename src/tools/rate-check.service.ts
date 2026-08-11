import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { Tool } from '../db/schema';
import { REDIS_CLIENT } from '../redis.constants';

type RateLimitConfig = {
  maxRequests: number;
  windowSeconds: number;
};

type RateCheckResult = {
  allowed: true;
  limit: number;
  windowSeconds: number;
  remaining: number;
  resetAt: string;
};

@Injectable()
export class RateCheckService {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async check(tool: Tool): Promise<RateCheckResult> {
    const rateLimit = this.parseRateLimit(tool.rateLimit);

    const now = Date.now();
    const windowMs = rateLimit.windowSeconds * 1000;
    const windowStart = now - windowMs;
    const rateKey = this.getRateKey(tool.slug);

    await this.redis.zremrangebyscore(rateKey, 0, windowStart);

    const currentCount = await this.redis.zcard(rateKey);

    if (currentCount >= rateLimit.maxRequests) {
      const oldestEntry = await this.redis.zrange(rateKey, 0, 0, 'WITHSCORES');
      const oldestScore = oldestEntry[1] ? Number(oldestEntry[1]) : now;

      throw new HttpException({
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded for tool slug: ${tool.slug}`,
        limit: rateLimit.maxRequests,
        windowSeconds: rateLimit.windowSeconds,
        remaining: 0,
        resetAt: new Date(oldestScore + windowMs).toISOString(),
      },
    HttpStatus.TOO_MANY_REQUESTS,);
    }

    await this.redis.zadd(rateKey, now, `${now}:${randomUUID()}`);
    await this.redis.expire(rateKey, rateLimit.windowSeconds);

    return {
      allowed: true,
      limit: rateLimit.maxRequests,
      windowSeconds: rateLimit.windowSeconds,
      remaining: rateLimit.maxRequests - currentCount - 1,
      resetAt: new Date(now + windowMs).toISOString(),
    };
  }

  private parseRateLimit(value: unknown): RateLimitConfig {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException({
        code: 'INVALID_RATE_LIMIT',
        message: 'Tool does not have a valid rate_limit config.',
      });
    }

    const rateLimit = value as Record<string, unknown>;

    if (
      typeof rateLimit.maxRequests !== 'number' ||
      typeof rateLimit.windowSeconds !== 'number'
    ) {
      throw new BadRequestException({
        code: 'INVALID_RATE_LIMIT',
        message:
          'rate_limit must include numeric maxRequests and windowSeconds values.',
      });
    }

    return {
      maxRequests: rateLimit.maxRequests,
      windowSeconds: rateLimit.windowSeconds,
    };
  }

  private getRateKey(slug: string): string {
    return `rate:tool:${slug}`;
  }
}
