import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { ToolsModule } from './tools/tools.module';
import { MockModule } from './mock/mock.module';
import { AgentModule } from './agent/agent.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }),ToolsModule,MockModule, AgentModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}