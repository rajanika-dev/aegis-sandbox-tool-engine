import { Inject, Injectable } from '@nestjs/common';
import { desc } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DB } from '../db/database.constants';
import * as schema from '../db/schema';
import { agentRequests } from '../db/schema';

type RecordAgentRequestInput = {
  message: string;
  createdBy: string;
  status: 'success' | 'failure';
  answer?: string;
  planner?: string;
  steps?: unknown;
  errorMessage?: string;
  userAgent?: string;
  ipAddress?: string;
};

@Injectable()
export class AgentRequestRecorderService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async record(input: RecordAgentRequestInput) {
    const [record] = await this.db
      .insert(agentRequests)
      .values({
        message: input.message,
        createdBy: input.createdBy,
        status: input.status,
        answer: input.answer,
        planner: input.planner,
        steps: input.steps,
        errorMessage: input.errorMessage,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
      })
      .returning({ id: agentRequests.id });

    return { requestId: record.id };
  }

  async findRecent(limit = 20) {
    return this.db
      .select({
        id: agentRequests.id,
        createdAt: agentRequests.createdAt,
        createdBy: agentRequests.createdBy,
        message: agentRequests.message,
        status: agentRequests.status,
        answer: agentRequests.answer,
        planner: agentRequests.planner,
        errorMessage: agentRequests.errorMessage,
        steps: agentRequests.steps,
      })
      .from(agentRequests)
      .orderBy(desc(agentRequests.createdAt))
      .limit(limit);
  }
}
