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
  async execute(
    tool: Tool,
    input: Record<string, unknown> = {},
  ): Promise<HttpExecutionResult> {
    if (tool.type !== 'http') {
      throw new BadRequestException({
        code: 'UNSUPPORTED_TOOL_TYPE',
        message: `HTTP executor cannot run tool type: ${tool.type}`,
      });
    }

    const config = this.parseHttpConfig(tool.config);
    const url = this.interpolateString(config.url, input, true);
    const headers = this.interpolateHeaders(config.headers ?? {}, input);
    const body = this.interpolateValue(config.body, input);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), tool.timeoutMs);

    try {
      const response = await fetch(url, {
        method: config.method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body:
          config.body === undefined || config.method.toUpperCase() === 'GET'
            ? undefined
            : JSON.stringify(body),
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

  private interpolateHeaders(
    headers: Record<string, string>,
    input: Record<string, unknown>,
  ): Record<string, string> {
    return Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [
        key,
        this.interpolateString(value, input, false),
      ]),
   );
  }

  private interpolateValue(value: unknown, input: Record<string, unknown>): unknown {
    if (typeof value === 'string') {
      return this.interpolateString(value, input, false);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.interpolateValue(item, input));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [
          key,
          this.interpolateValue(nestedValue, input),
        ]),
      );
    }

    return value;
  }

  private interpolateString(
    value: string,
    input: Record<string, unknown>,
    encode: boolean,
  ): string {
    return value.replace(/\{\{([a-zA-Z0-9_.-]+)\}\}/g, (_, key: string) => {
      const replacement = this.getInputValue(input, key);

      if (replacement === undefined || replacement === null) {
        throw new BadRequestException({
          code: 'MISSING_TOOL_INPUT',
          message: `Missing required tool input: ${key}`,
        });
      }

      const stringValue = String(replacement);
      return encode ? encodeURIComponent(stringValue) : stringValue;
    });
  }

  private getInputValue(
    input: Record<string, unknown>,
    path: string,
  ): unknown {
   if (path.startsWith('env.')) {
     const envKey = path.replace('env.', '');
     return process.env[envKey];
   }

   return path.split('.').reduce<unknown>((current, key) => {
     if (!current || typeof current !== 'object') {
       return undefined;
      }

     return (current as Record<string, unknown>)[key];
   }, input);
  }

}
