import { BadRequestException, Injectable } from '@nestjs/common';
import { HttpToolExecutorService } from './http-tool-executor.service';
import { RateCheckService } from './rate-check.service';
import { ToolExecutionRecorderService } from './tool-execution-recorder.service';
import { ToolResolverService } from './tool-resolver.service';
import { ToolTransformService } from './tool-transform.service';
import { SqlToolExecutorService } from './sql-tool-executor.service';

@Injectable()
export class ToolPipelineService {
  constructor(
    private readonly toolResolverService: ToolResolverService,
    private readonly rateCheckService: RateCheckService,
    private readonly httpToolExecutorService: HttpToolExecutorService,
    private readonly sqlToolExecutorService: SqlToolExecutorService,
    private readonly toolTransformService: ToolTransformService,
    private readonly toolExecutionRecorderService: ToolExecutionRecorderService,
  ) {}

  async run(
    toolSlug: string,
    input: Record<string, unknown> = {},
    createdBy = 'rajanika',
  ) {
    const resolved = await this.toolResolverService.resolveBySlug(toolSlug);
    const rateCheck = await this.rateCheckService.check(resolved.tool);

    const startedAt = Date.now();

    const execution =
      resolved.tool.type === 'http'
        ? await this.httpToolExecutorService.execute(resolved.tool, input)
        : resolved.tool.type === 'sql'
          ? await this.sqlToolExecutorService.execute(resolved.tool, input)
          : this.unsupportedToolType(resolved.tool.type);

    const transformed = this.toolTransformService.transform(
      resolved.tool,
      execution,
      input,
    );

    const record = await this.toolExecutionRecorderService.record({
      tool: resolved.tool,
      resolveSource: resolved.source,
      status: execution.ok ? 'success' : 'failure',
      latencyMs: Date.now() - startedAt,
      httpStatus: execution.status,
      rawOutput: execution,
      transformedOutput: transformed,
      createdBy,
    });

    return {
      resolveSource: resolved.source,
      rateCheck,
      tool: {
        id: resolved.tool.id,
        slug: resolved.tool.slug,
        type: resolved.tool.type,
      },
      execution,
      transformed,
      record,
    };
  }

  private unsupportedToolType(toolType: string): never {
    throw new BadRequestException({
      code: 'UNSUPPORTED_TOOL_TYPE',
      message: `Unsupported Tool type: ${toolType}`,
    });
  }
}
