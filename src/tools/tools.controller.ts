import { Controller, Get, Param } from '@nestjs/common';
import { ToolResolverService } from './tool-resolver.service';

@Controller('tools')
export class ToolsController {
  constructor(private readonly toolResolverService: ToolResolverService) {}

  @Get(':slug/resolve')
  resolveTool(@Param('slug') slug: string) {
    return this.toolResolverService.resolveBySlug(slug);
  }
}
