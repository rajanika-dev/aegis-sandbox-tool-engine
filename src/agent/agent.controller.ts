import { Body, Controller, Post } from '@nestjs/common';
import { AgentService } from './agent.service';

type AgentQueryBody = {
  message: string;
  createdBy?: string;
};

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('query')
  query(@Body() body: AgentQueryBody) {
    return this.agentService.query(body.message, body.createdBy ?? 'rajanika');
  }
}
