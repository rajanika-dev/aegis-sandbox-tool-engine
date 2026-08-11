import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { ToolsModule } from './tools/tools.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }),ToolsModule,],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}