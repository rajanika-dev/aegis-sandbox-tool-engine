import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LlmChatRequest,
  LlmChatResponse,
  LlmMessage,
  LlmProvider,
} from './llm-provider.interface';

type OllamaChatResponse = {
  message?: LlmMessage;
};

@Injectable()
export class OllamaProvider implements LlmProvider {
  readonly id = 'ollama';

  constructor(private readonly configService: ConfigService) {}

  async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    const baseUrl = (
      this.configService.get<string>('OLLAMA_BASE_URL') ??
      'http://localhost:11434'
    ).replace(/\/$/, '');
    const apiKey = this.configService.get<string>('OLLAMA_API_KEY');

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: request.model,
        stream: false,
        ...(request.responseFormat ? { format: request.responseFormat } : {}),
        messages: request.messages,
        ...(request.tools ? { tools: request.tools } : {}),
        ...(request.temperature === undefined
          ? {}
          : { options: { temperature: request.temperature } }),
      }),
    });

    if (!response.ok) {
      const details = await response.text();

      throw new BadRequestException({
        code: 'OLLAMA_CHAT_FAILED',
        message: `Ollama returned ${response.status}`,
        details,
      });
    }

    const result = (await response.json()) as OllamaChatResponse;

    if (!result.message) {
      throw new BadRequestException({
        code: 'OLLAMA_EMPTY_RESPONSE',
        message: 'Ollama did not return a message.',
      });
    }

    return { message: result.message };
  }
}
