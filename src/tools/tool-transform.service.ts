import { Injectable } from '@nestjs/common';

type HttpExecutionResult = {
  status: number;
  ok: boolean;
  data: unknown;
};

type TransformResult = {
  normalized: unknown;
  summary: string;
};

@Injectable()
export class ToolTransformService {
  transform(execution: HttpExecutionResult): TransformResult {
    const data = execution.data;

    if (this.isJsonPlaceholderTodo(data)) {
      return {
        normalized: {
          id: data.id,
          title: data.title,
          completed: data.completed,
          status: data.completed ? 'completed' : 'open',
        },
        summary: `Todo ${data.id} is ${data.completed ? 'completed' : 'not completed'}.`,
      };
    }

    return {
      normalized: data,
      summary: 'Tool response was returned without a custom transform.',
    };
  }

  private isJsonPlaceholderTodo(value: unknown): value is {
    userId: number;
    id: number;
    title: string;
    completed: boolean;
  } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      'title' in value &&
      'completed' in value
    );
  }
}
