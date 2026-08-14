import {
  BadRequestException,
  Injectable,
  RequestTimeoutException,
} from '@nestjs/common';
import { Tool } from '../db/schema';

type HttpToolConfig = {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
};

type HttpExecutionResult = {
  status: number;
  ok: boolean;
  data: unknown;
};

@Injectable()
export class HttpToolExecutorService {
  async execute(tool: Tool): Promise<HttpExecutionResult> {
    if (tool.type !== 'http') {
      throw new BadRequestException({
        code: 'UNSUPPORTED_TOOL_TYPE',
        message: `HTTP executor cannot run tool type: ${tool.type}`,
      });
    }

    const config = this.parseHttpConfig(tool.config);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), tool.timeoutMs);

    try {
      const response = await fetch(config.url, {
        method: config.method,
        headers: {
          'Content-Type': 'application/json',
          ...(config.headers ?? {}),
        },
        body:
          config.body === undefined || config.method.toUpperCase() === 'GET'
            ? undefined
            : JSON.stringify(config.body),
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type');
      const data = contentType?.includes('application/json')
        ? await response.json()
        : await response.text();

      return {
        status: response.status,
        ok: response.ok,
        data,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new RequestTimeoutException({
          code: 'TOOL_TIMEOUT',
          message: `Tool execution timed out after ${tool.timeoutMs}ms`,
        });
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseHttpConfig(value: unknown): HttpToolConfig {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException({
        code: 'INVALID_HTTP_CONFIG',
        message: 'HTTP tool config must be an object.',
      });
    }

    const config = value as Record<string, unknown>;

    if (typeof config.method !== 'string' || typeof config.url !== 'string') {
      throw new BadRequestException({
        code: 'INVALID_HTTP_CONFIG',
        message: 'HTTP tool config must include method and url.',
      });
    }

    if (
      config.headers !== undefined &&
      (typeof config.headers !== 'object' || config.headers === null)
    ) {
      throw new BadRequestException({
        code: 'INVALID_HTTP_CONFIG',
        message: 'HTTP tool headers must be an object.',
      });
    }

    return {
      method: config.method,
      url: config.url,
      headers: config.headers as Record<string, string> | undefined,
      body: config.body,
    };
  }
}
