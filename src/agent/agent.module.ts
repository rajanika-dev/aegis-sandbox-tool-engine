import { Module } from '@nestjs/common';
import { ToolsModule } from '../tools/tools.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { LlmPlannerService } from './llm-planner.service';
import { DatabaseModule } from '../db/database.module';
import { AgentRequestRecorderService } from './agent-request-recorder.service';
import { LLM_PROVIDERS } from './llm-provider.constants';
import { ModelRegistryService } from './model-registry.service';
import { OllamaProvider } from './ollama.provider';

@Module({
  imports: [ToolsModule, DatabaseModule],
  controllers: [AgentController],
  providers: [
    AgentService,
    LlmPlannerService,
    AgentRequestRecorderService,
    OllamaProvider,
    {
      provide: LLM_PROVIDERS,
      useFactory: (ollamaProvider: OllamaProvider) => [ollamaProvider],
      inject: [OllamaProvider],
    },
    ModelRegistryService,
  ],
})
export class AgentModule {}
