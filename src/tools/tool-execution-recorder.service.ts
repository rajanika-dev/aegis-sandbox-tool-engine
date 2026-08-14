import { Inject, Injectable } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DB } from '../db/database.constants';
import * as schema from '../db/schema';
import { Tool, toolExecutions } from '../db/schema';

type RecordExecutionInput = {
  tool: Tool;
  resolveSource: 'redis' | 'postgres';
  status: 'success' | 'failure';
  latencyMs: number;
  httpStatus?: number;
  rawOutput?: unknown;
  transformedOutput?: unknown;
  errorMessage?: string;
  createdBy?: string;
};

@Injectable()
export class ToolExecutionRecorderService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async record(input: RecordExecutionInput): Promise<{ executionId: string }> {
    const outputSizeBytes = this.getOutputSizeBytes({
      rawOutput: input.rawOutput,
      transformedOutput: input.transformedOutput,
    });

    const [record] = await this.db
      .insert(toolExecutions)
      .values({
        toolId: input.tool.id,
        toolSlug: input.tool.slug,
        resolveSource: input.resolveSource,
        status: input.status,
        httpStatus: input.httpStatus,
        latencyMs: input.latencyMs,
        outputSizeBytes,
        errorMessage: input.errorMessage,
        rawOutput: input.rawOutput,
        transformedOutput: input.transformedOutput,
        createdBy: input.createdBy ?? 'rajanika',
      })
      .returning({ id: toolExecutions.id });

    return {
      executionId: record.id,
    };
  }

  private getOutputSizeBytes(value: unknown): number {
    return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
  }
}
