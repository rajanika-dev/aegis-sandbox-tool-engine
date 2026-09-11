import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { AgentRequestRecorderService } from './agent-request-recorder.service';
import { AgentService } from './agent.service';

type AgentQueryBody = {
  message: string;
  createdBy?: string;
};

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
};

@Controller('agent')
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly agentRequestRecorderService: AgentRequestRecorderService,
  ) {}

  @Post('query')
  async query(@Body() body: AgentQueryBody, @Req() request: RequestLike) {
    const message = body.message;
    const createdBy = body.createdBy ?? 'demo-user';

    try {
      const result = await this.agentService.query(message, createdBy);

      const record = await this.agentRequestRecorderService.record({
        message,
        createdBy,
        status: 'success',
        answer: result.answer,
        planner: result.planner,
        steps: result.steps,
        userAgent: this.getHeader(request, 'user-agent'),
        ipAddress: this.getIpAddress(request),
      });

      return {
        requestId: record.requestId,
        ...result,
      };
    } catch (error) {
      await this.agentRequestRecorderService.record({
        message: message ?? '',
        createdBy,
        status: 'failure',
        errorMessage: this.getErrorMessage(error),
        userAgent: this.getHeader(request, 'user-agent'),
        ipAddress: this.getIpAddress(request),
      });

      throw error;
    }
  }

  @Get('requests/recent')
  recentRequests() {
    return this.agentRequestRecorderService.findRecent(20);
  }

  private getHeader(request: RequestLike, name: string): string | undefined {
    const value = request.headers?.[name];

    if (Array.isArray(value)) {
      return value.join(', ');
    }

    return value;
  }

  private getIpAddress(request: RequestLike): string | undefined {
    return request.ip ?? request.socket?.remoteAddress;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown agent error.';
  }
}
