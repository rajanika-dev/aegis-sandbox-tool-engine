export type LlmRole = 'system' | 'user' | 'assistant' | 'tool';

export type LlmToolCall = {
  function: {
    name: string;
    arguments: Record<string, unknown> | string;
  };
};

export type LlmMessage = {
  role: LlmRole;
  content?: string;
  tool_name?: string;
  tool_calls?: LlmToolCall[];
};

export type LlmTool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type LlmChatRequest = {
  model: string;
  messages: LlmMessage[];
  tools?: LlmTool[];
  temperature?: number;
  responseFormat?: 'json';
};

export type LlmChatResponse = {
  message: LlmMessage;
};

export interface LlmProvider {
  readonly id: string;
  chat(request: LlmChatRequest): Promise<LlmChatResponse>;
}
