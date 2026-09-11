import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { ToolsModule } from './tools/tools.module';
import { MockModule } from './mock/mock.module';
import { AgentModule } from './agent/agent.module';
import { DemoController } from './demo/demo.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }),ToolsModule,MockModule, AgentModule],
  controllers: [AppController, HealthController, DemoController],
  providers: [AppService],
})
export class AppModule {}