import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentService } from './agent.service';
import type { LlmProvider } from './llm-provider.interface';
import { ModelRegistryService } from './model-registry.service';

function createAgent() {
  const chat = jest.fn().mockResolvedValue({
    message: { role: 'assistant', content: 'Final answer' },
  });
  const provider = { id: 'ollama', chat } as unknown as LlmProvider;
  const registry = new ModelRegistryService(
    new ConfigService({
      DEFAULT_MODEL_ID: 'ollama-nemotron',
      LLM_MODELS: JSON.stringify([
        {
          id: 'ollama-local',
          provider: 'ollama',
          model: 'qwen2.5:1.5b',
        },
        {
          id: 'ollama-nemotron',
          provider: 'ollama',
          model: 'nemotron-3-nano:30b-cloud',
        },
      ]),
    }),
    [provider],
  );
  const toolPipeline = { run: jest.fn() };

  return {
    service: new AgentService(toolPipeline as never, registry),
    chat,
  };
}

describe('AgentService model selection', () => {
  it('uses DEFAULT_MODEL_ID when modelId is missing', async () => {
    const { service, chat } = createAgent();

    const result = await service.query('How many submissions exist?');

    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'nemotron-3-nano:30b-cloud' }),
    );
    expect(result).toMatchObject({
      modelId: 'ollama-nemotron',
      provider: 'ollama',
    });
  });

  it('routes a valid modelId through the matching provider and model', async () => {
    const { service, chat } = createAgent();

    const result = await service.query(
      'How many submissions exist?',
      'demo-user',
      'ollama-local',
    );

    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'qwen2.5:1.5b' }),
    );
    expect(result).toMatchObject({
      modelId: 'ollama-local',
      provider: 'ollama',
    });
  });

  it('returns a 400 validation error for an unknown modelId', async () => {
    const { service, chat } = createAgent();

    await expect(
      service.query('How many submissions exist?', 'demo-user', 'missing'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(chat).not.toHaveBeenCalled();
  });

  it('compares the default model when modelIds is missing', async () => {
    const { service, chat } = createAgent();

    const result = await service.compare('How many submissions exist?');

    expect(chat).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      question: 'How many submissions exist?',
      results: [
        expect.objectContaining({
          modelId: 'ollama-nemotron',
          provider: 'ollama',
          status: 'success',
        }),
      ],
    });
  });

  it('compares one valid model and includes latencyMs', async () => {
    const { service, chat } = createAgent();

    const result = await service.compare('How many submissions exist?', [
      'ollama-local',
    ]);

    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'qwen2.5:1.5b' }),
    );
    expect(result.results[0]).toEqual(
      expect.objectContaining({
        modelId: 'ollama-local',
        status: 'success',
      }),
    );
    expect(typeof result.results[0]?.latencyMs).toBe('number');
  });

  it('validates all comparison model IDs before running providers', async () => {
    const { service, chat } = createAgent();

    await expect(
      service.compare('How many submissions exist?', [
        'ollama-local',
        'missing-model',
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(chat).not.toHaveBeenCalled();
  });

  it('keeps one model failure inside the comparison response', async () => {
    const { service, chat } = createAgent();
    chat.mockImplementation((request: { model: string }) => {
      if (request.model === 'qwen2.5:1.5b') {
        return Promise.reject(new Error('provider unavailable'));
      }

      return Promise.resolve({
        message: { role: 'assistant', content: 'Final answer' },
      });
    });

    const result = await service.compare('How many submissions exist?', [
      'ollama-local',
      'ollama-nemotron',
    ]);

    expect(result.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          modelId: 'ollama-local',
          status: 'failure',
          error: 'provider unavailable',
        }),
        expect.objectContaining({
          modelId: 'ollama-nemotron',
          status: 'success',
        }),
      ]),
    );
    for (const comparison of result.results) {
      expect(typeof comparison.latencyMs).toBe('number');
    }
    expect(result.totalLatencyMs).toEqual(expect.any(Number));
  });
});
