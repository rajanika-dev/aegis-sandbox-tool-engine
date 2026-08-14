import { Module } from '@nestjs/common';
import { DatabaseModule } from '../db/database.module';
import { RedisModule } from '../redis.module';
import { ToolResolverService } from './tool-resolver.service';
import { ToolsController } from './tools.controller';
import { RateCheckService } from './rate-check.service';
import { HttpToolExecutorService } from './http-tool-executor.service';
import { ToolTransformService } from './tool-transform.service';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [ToolsController],
  providers: [ToolResolverService, RateCheckService, HttpToolExecutorService, ToolTransformService],
})
export class ToolsModule {}
