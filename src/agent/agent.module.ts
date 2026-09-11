import { Module } from '@nestjs/common';
import { ToolsModule } from '../tools/tools.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { LlmPlannerService } from './llm-planner.service';
import { DatabaseModule } from '../db/database.module';
import { AgentRequestRecorderService } from './agent-request-recorder.service';


@Module({
  imports: [ToolsModule, DatabaseModule],
  controllers: [AgentController],
  providers: [AgentService, LlmPlannerService, AgentRequestRecorderService],
})
export class AgentModule {}
