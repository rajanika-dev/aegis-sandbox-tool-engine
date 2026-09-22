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
});
