import { BadRequestException, Injectable } from '@nestjs/common';
import { ToolPipelineService } from '../tools/tool-pipeline.service';

type PipelineResult = Awaited<ReturnType<ToolPipelineService['run']>>;

type OllamaRole = 'system' | 'user' | 'assistant' | 'tool';

type OllamaToolCall = {
  function: {
    name: string;
    arguments: Record<string, unknown> | string;
  };
};

type OllamaMessage = {
  role: OllamaRole;
  content?: string;
  tool_name?: string;
  tool_calls?: OllamaToolCall[];
};

type OllamaChatResponse = {
  message?: OllamaMessage;
};

type AgentStep = {
  order: number;
  functionName: string;
  toolSlug?: string;
  arguments: Record<string, unknown>;
  executionId?: string;
  summary: string;
};

const SYSTEM_PROMPT = `
You are an AEGIS function-calling agent.

Use approved tools when needed. Do not invent live weather data or database facts.

For any question about tool executions, tool history, tool names, counts, failures, statuses, latency, recent activity, or registered tools:
1. Call get_database_schema first.
2. Then call run_readonly_sql using only listed tables and columns.
3. Answer only from the SQL result.

For weather questions, use coordinate/weather tools.

If the user asks to delete, update, insert, drop, or modify data, refuse. Do not call SQL for destructive requests.

After tool results are available, answer concisely using those results.

When the user asks about recent tool executions, last tool executions, tool history, execution logs, failed tools, counts, statuses, 
latency, or registered tools, they are asking about the Postgres database tables, not the current conversation. 
You must call get_database_schema first, then run_readonly_sql. 
Never answer that there are no tools in the current conversation unless the SQL result proves there are no rows.

`.trim();

const DATABASE_SCHEMA = {
  tables: {
    tools: [
      'id',
      'name',
      'slug',
      'type',
      'description',
      'enabled',
      'created_at',
    ],
    tool_executions: [
      'id',
      'tool_id',
      'tool_slug',
      'resolve_source',
      'status',
      'http_status',
      'latency_ms',
      'output_size_bytes',
      'error_message',
      'created_at',
      'created_by',
    ],
  },
  rules: [
    'Only SELECT queries are allowed.',
    'Only tools and tool_executions may be queried.',
    'Use snake_case column names.',
    'Use LIMIT 20 or less unless the user asks otherwise.',
  ],
};

@Injectable()
export class AgentService {
  constructor(private readonly toolPipelineService: ToolPipelineService) {}

  async query(message: string, createdBy = 'rajanika') {
    if (!message || typeof message !== 'string') {
      throw new BadRequestException({
        code: 'INVALID_AGENT_QUERY',
        message: 'message is required.',
      });
    }

    return this.runAgent(message.trim(), createdBy);
  }

  private async runAgent(message: string, createdBy: string) {
    const messages: OllamaMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: message },
    ];

    const steps: AgentStep[] = [];
    const maxTurns = 6;

    for (let turn = 0; turn < maxTurns; turn += 1) {
      const assistantMessage = await this.callOllama(messages);
      messages.push(assistantMessage);

      const toolCalls = assistantMessage.tool_calls ?? [];

      if (toolCalls.length === 0) {
        return {
          answer:
            assistantMessage.content?.trim() ||
            'The agent did not return a final answer.',
          planner: 'ollama_function_calling',
          steps,
        };
      }

      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const args = this.normalizeArguments(toolCall.function.arguments);

        const toolResult = await this.executeToolFunction(
          functionName,
          args,
          createdBy,
          steps.length + 1,
        );

        steps.push(toolResult.step);

        messages.push({
          role: 'tool',
          tool_name: functionName,
          content: toolResult.content,
        });
      }
    }

    return {
      answer:
        'The agent reached the maximum number of tool-calling turns before producing a final answer.',
      planner: 'ollama_function_calling',
      steps,
    };
  }

  private async callOllama(messages: OllamaMessage[]): Promise<OllamaMessage> {
    const baseUrl = (
      process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
    ).replace(/\/$/, '');

    const model = process.env.OLLAMA_MODEL ?? 'qwen2.5:1.5b';
    const apiKey = process.env.OLLAMA_API_KEY;

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages,
        tools: this.getFunctionTools(),
        options: {
          temperature: 0,
        },
      }),
    });

    if (!response.ok) {
      throw new BadRequestException({
        code: 'OLLAMA_CHAT_FAILED',
        message: `Ollama returned ${response.status}`,
        details: await response.text(),
      });
    }

    const result = (await response.json()) as OllamaChatResponse;

    if (!result.message) {
      throw new BadRequestException({
        code: 'OLLAMA_EMPTY_RESPONSE',
        message: 'Ollama did not return a message.',
      });
    }

    return result.message;
  }

  private getFunctionTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'get_coordinates',
          description: 'Convert city/state/country to latitude and longitude.',
          parameters: {
            type: 'object',
            required: ['city'],
            properties: {
              city: { type: 'string' },
              state: { type: 'string' },
              country: { type: 'string' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_current_weather',
          description: 'Get current weather using latitude and longitude.',
          parameters: {
            type: 'object',
            required: ['latitude', 'longitude'],
            properties: {
              latitude: { type: 'number' },
              longitude: { type: 'number' },
              city: { type: 'string' },
              state: { type: 'string' },
              country: { type: 'string' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_database_schema',
          description:
            'Use this first for database questions. It returns the allowed AEGIS database tables and exact column names.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'run_readonly_sql',
          description:
            'Run one safe SELECT query after inspecting the schema. Use only exact listed table and column names.',
          parameters: {
            type: 'object',
            required: ['sql'],
            properties: {
              sql: {
                type: 'string',
                description:
                  'Single SELECT query using only tools or tool_executions. Include LIMIT 20 or less.',
              },
            },
          },
        },
      },
    ];
  }

  private async executeToolFunction(
    functionName: string,
    args: Record<string, unknown>,
    createdBy: string,
    order: number,
  ): Promise<{ step: AgentStep; content: string }> {
    try {
      switch (functionName) {
        case 'get_database_schema':
          return this.toolResult(order, functionName, args, undefined, {
            ok: true,
            schema: DATABASE_SCHEMA,
          });

        case 'run_readonly_sql': {
          const sql = this.requireString(args.sql, 'sql');
          const result = await this.toolPipelineService.run(
            'sql_query',
            { sql },
            createdBy,
          );

          return this.pipelineToolResult(
            order,
            functionName,
            'sql_query',
            args,
            result,
          );
        }

        case 'get_coordinates': {
          const city = this.requireString(args.city, 'city');
          const state = this.optionalString(args.state) ?? '';
          const country = this.optionalString(args.country) ?? 'US';

          const result = await this.toolPipelineService.run(
            'geo_lookup',
            { city, state, country },
            createdBy,
          );

          return this.pipelineToolResult(
            order,
            functionName,
            'geo_lookup',
            args,
            result,
          );
        }

        case 'get_current_weather': {
          const latitude = this.requireNumber(args.latitude, 'latitude');
          const longitude = this.requireNumber(args.longitude, 'longitude');

          const result = await this.toolPipelineService.run(
            'weather_lookup',
            {
              latitude,
              longitude,
              city: this.optionalString(args.city) ?? '',
              state: this.optionalString(args.state) ?? '',
              country: this.optionalString(args.country) ?? 'US',
            },
            createdBy,
          );

          return this.pipelineToolResult(
            order,
            functionName,
            'weather_lookup',
            args,
            result,
          );
        }

        default:
          return this.toolResult(order, functionName, args, undefined, {
            ok: false,
            error: `Unknown function requested: ${functionName}`,
          });
      }
    } catch (error) {
      return this.toolResult(order, functionName, args, undefined, {
        ok: false,
        error: this.errorMessage(error),
      });
    }
  }

  private pipelineToolResult(
    order: number,
    functionName: string,
    toolSlug: string,
    args: Record<string, unknown>,
    result: PipelineResult,
  ) {
    const summary = this.extractSummary(result);
    const executionId = this.extractExecutionId(result);

    return {
      step: {
        order,
        functionName,
        toolSlug,
        arguments: args,
        executionId,
        summary,
      },
      content: JSON.stringify({
        ok: true,
        summary,
        executionId,
        data: this.extractTransformedOutput(result),
      }),
    };
  }

  private toolResult(
    order: number,
    functionName: string,
    args: Record<string, unknown>,
    toolSlug: string | undefined,
    content: Record<string, unknown>,
  ) {
    return {
      step: {
        order,
        functionName,
        toolSlug,
        arguments: args,
        summary: this.asString(content.summary) ?? JSON.stringify(content),
      },
      content: JSON.stringify(content),
    };
  }

  private normalizeArguments(
    args: Record<string, unknown> | string,
  ): Record<string, unknown> {
    if (typeof args !== 'string') {
      return args;
    }

    try {
      return this.asRecord(JSON.parse(args)) ?? {};
    } catch {
      return {};
    }
  }

  private extractSummary(result: PipelineResult): string {
    const resultObject = this.asRecord(result);
    const transformedObject = this.asRecord(resultObject?.transformed);

    return (
      this.asString(transformedObject?.summary) ??
      this.asString(resultObject?.summary) ??
      'Tool execution completed.'
    );
  }

  private extractExecutionId(result: PipelineResult): string | undefined {
    const resultObject = this.asRecord(result);
    const recordObject = this.asRecord(resultObject?.record);

    return (
      this.asString(recordObject?.executionId) ??
      this.asString(recordObject?.id)
    );
  }

  private extractTransformedOutput(result: PipelineResult): unknown {
    const resultObject = this.asRecord(result);
    const transformedObject = this.asRecord(resultObject?.transformed);

    return (
      transformedObject?.normalized ??
      transformedObject?.output ??
      resultObject?.transformed ??
      result
    );
  }

  private requireString(value: unknown, fieldName: string): string {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    throw new Error(`${fieldName} is required.`);
  }

  private optionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim()
      ? value.trim()
      : undefined;
  }

  private requireNumber(value: unknown, fieldName: string): number {
    const numberValue = typeof value === 'number' ? value : Number(value);

    if (Number.isFinite(numberValue)) {
      return numberValue;
    }

    throw new Error(`${fieldName} must be a valid number.`);
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim()
      ? value.trim()
      : undefined;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown tool error.';
  }
}
