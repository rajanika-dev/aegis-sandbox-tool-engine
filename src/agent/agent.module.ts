import { Module } from '@nestjs/common';
import { ToolsModule } from '../tools/tools.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { LlmPlannerService } from './llm-planner.service';

@Module({
  imports: [ToolsModule],
  controllers: [AgentController],
  providers: [AgentService, LlmPlannerService],
})
export class AgentModule {}
