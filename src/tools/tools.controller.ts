import { Controller, Get, Param } from '@nestjs/common';
import { RateCheckService } from './rate-check.service';
import { ToolResolverService } from './tool-resolver.service';

@Controller('tools')
export class ToolsController {
  constructor(
    private readonly toolResolverService: ToolResolverService,
    private readonly rateCheckService: RateCheckService,
  ) {}

  @Get(':slug/resolve')
  resolveTool(@Param('slug') slug: string) {
    return this.toolResolverService.resolveBySlug(slug);
  }

  @Get(':slug/rate-check')
  async rateCheck(@Param('slug') slug: string) {
    const resolved = await this.toolResolverService.resolveBySlug(slug);
    const rateCheck = await this.rateCheckService.check(resolved.tool);

    return {
      resolveSource: resolved.source,
      rateCheck,
      tool: {
        id: resolved.tool.id,
        slug: resolved.tool.slug,
        type: resolved.tool.type,
        rateLimit: resolved.tool.rateLimit,
      },
    };
  }
}
