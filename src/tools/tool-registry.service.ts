import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DB } from '../db/database.constants';
import * as schema from '../db/schema';
import { tools } from '../db/schema';

type RegisterToolInput = {
  name: string;
  slug: string;
  type?: string;
  description?: string;
  config: unknown;
  rateLimit?: unknown;
  timeoutMs?: number;
  enabled?: boolean;
  createdBy?: string;
  updatedBy?: string;
};

@Injectable()
export class ToolRegistryService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async upsertTool(input: RegisterToolInput) {
    this.validateToolInput(input);

    const toolType = input.type ?? 'http';

    const [tool] = await this.db
      .insert(tools)
      .values({
        name: input.name,
        slug: input.slug,
        type: toolType,
        description: input.description,
        config: input.config,
        rateLimit: input.rateLimit ?? {
          maxRequests: 3,
          windowSeconds: 60,
        },
        timeoutMs: input.timeoutMs ?? 5000,
        enabled: input.enabled ?? true,
        createdBy: input.createdBy ?? 'rajanika',
        updatedBy: input.updatedBy ?? 'rajanika',
      })
      .onConflictDoUpdate({
        target: tools.slug,
        set: {
          name: input.name,
          type: toolType,
          description: input.description,
          config: input.config,
          rateLimit: input.rateLimit ?? {
            maxRequests: 3,
            windowSeconds: 60,
          },
          timeoutMs: input.timeoutMs ?? 5000,
          enabled: input.enabled ?? true,
          updatedBy: input.updatedBy ?? 'rajanika',
          updatedAt: new Date(),
        },
      })
      .returning({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        type: tools.type,
        description: tools.description,
        enabled: tools.enabled,
        rateLimit: tools.rateLimit,
        timeoutMs: tools.timeoutMs,
        createdBy: tools.createdBy,
        updatedBy: tools.updatedBy,
      });

    return tool;
  }

  private validateToolInput(input: RegisterToolInput) {
    if (!input.name || !input.slug || !input.config) {
      throw new BadRequestException({
        code: 'INVALID_TOOL_INPUT',
        message: 'Tool name, slug, and config are required.',
      });
    }

    if (!/^[a-z0-9_-]+$/.test(input.slug)) {
      throw new BadRequestException({
        code: 'INVALID_TOOL_SLUG',
        message: 'Tool slug can only contain lowercase letters, numbers, underscores, and hyphens.',
      });
    }

    const toolType = input.type ?? 'http';

    if (toolType !== 'http') {
      throw new BadRequestException({
        code: 'UNSUPPORTED_TOOL_TYPE',
        message: 'Only http tools are supported in the current sandbox version.',
      });
    }

    if (typeof input.config !== 'object' || input.config === null) {
      throw new BadRequestException({
        code: 'INVALID_TOOL_CONFIG',
        message: 'Tool config must be an object.',
      });
    }

    const config = input.config as Record<string, unknown>;

    if (typeof config.method !== 'string' || typeof config.url !== 'string') {
      throw new BadRequestException({
        code: 'INVALID_HTTP_CONFIG',
        message: 'HTTP tool config must include method and url.',
      });
    }
  }
}
