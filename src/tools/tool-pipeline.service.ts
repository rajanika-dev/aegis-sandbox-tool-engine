import { Injectable } from '@nestjs/common';
import { HttpToolExecutorService } from './http-tool-executor.service';
import { RateCheckService } from './rate-check.service';
import { ToolExecutionRecorderService } from './tool-execution-recorder.service';
import { ToolResolverService } from './tool-resolver.service';
import { ToolTransformService } from './tool-transform.service';

@Injectable()
export class ToolPipelineService {
  constructor(
    private readonly toolResolverService: ToolResolverService,
    private readonly rateCheckService: RateCheckService,
    private readonly httpToolExecutorService: HttpToolExecutorService,
    private readonly toolTransformService: ToolTransformService,
    private readonly toolExecutionRecorderService: ToolExecutionRecorderService,
  ) {}

  async run(toolSlug: string, createdBy = 'rajanika') {
    const resolved = await this.toolResolverService.resolveBySlug(toolSlug);
    const rateCheck = await this.rateCheckService.check(resolved.tool);

    const startedAt = Date.now();

    const execution = await this.httpToolExecutorService.execute(resolved.tool);
    const transformed = this.toolTransformService.transform(execution);

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
}
