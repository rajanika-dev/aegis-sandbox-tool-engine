import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import Redis from 'ioredis';
import { DRIZZLE_DB } from '../db/database.constants';
import * as schema from '../db/schema';
import { Tool, tools } from '../db/schema';
import { REDIS_CLIENT } from '../redis.constants';

type ResolveSource = 'redis' | 'postgres';

@Injectable()
export class ToolResolverService {
  private readonly cacheTtlSeconds = 300;

  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: PostgresJsDatabase<typeof schema>,

    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async resolveBySlug(
    slug: string,
  ): Promise<{ source: ResolveSource; tool: Tool }> {
    const cacheKey = this.getCacheKey(slug);

    const cachedTool = await this.redis.get(cacheKey);

    if (cachedTool) {
      return {
        source: 'redis',
        tool: JSON.parse(cachedTool) as Tool,
      };
    }

    const [tool] = await this.db
      .select()
      .from(tools)
      .where(eq(tools.slug, slug))
      .limit(1);

    if (!tool) {
      throw new NotFoundException({
        code: 'TOOL_NOT_FOUND',
        message: `Tool definition was not found for slug: ${slug}`,
      });
    }

    await this.redis.set(
      cacheKey,
      JSON.stringify(tool),
      'EX',
      this.cacheTtlSeconds,
    );

    return {
      source: 'postgres',
      tool,
    };
  }

  private getCacheKey(slug: string): string {
    return `tool:slug:${slug}`;
  }
}
