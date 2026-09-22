import { Module } from '@nestjs/common';
import { ToolsModule } from '../tools/tools.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { LlmPlannerService } from './llm-planner.service';
import { DatabaseModule } from '../db/database.module';
import { AgentRequestRecorderService } from './agent-request-recorder.service';
import { LLM_PROVIDER } from './llm-provider.constants';
import { ModelRegistryService } from './model-registry.service';
import { OllamaProvider } from './ollama.provider';

@Module({
  imports: [ToolsModule, DatabaseModule],
  controllers: [AgentController],
  providers: [
    AgentService,
    LlmPlannerService,
    AgentRequestRecorderService,
    ModelRegistryService,
    OllamaProvider,
    {
      provide: LLM_PROVIDER,
      useExisting: OllamaProvider,
    },
  ],
})
export class AgentModule {}
