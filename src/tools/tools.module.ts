import { Module } from '@nestjs/common';
import { DatabaseModule } from '../db/database.module';
import { RedisModule } from '../redis.module';
import { ToolResolverService } from './tool-resolver.service';
import { ToolsController } from './tools.controller';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [ToolsController],
  providers: [ToolResolverService],
})
export class ToolsModule {}
