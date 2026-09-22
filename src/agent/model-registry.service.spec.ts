import { ConfigService } from '@nestjs/config';
import type { LlmProvider } from './llm-provider.interface';
import { ModelRegistryService } from './model-registry.service';

const ollamaProvider = {
  id: 'ollama',
  chat: jest.fn(),
} as unknown as LlmProvider;

describe('ModelRegistryService', () => {
  it('reads configured models and selects DEFAULT_MODEL_ID', () => {
    const service = new ModelRegistryService(
      new ConfigService({
        DEFAULT_MODEL_ID: 'ollama-cloud',
        LLM_MODELS: JSON.stringify([
          {
            id: 'ollama-local',
            provider: 'ollama',
            model: 'qwen2.5:1.5b',
          },
          {
            id: 'ollama-cloud',
            provider: 'ollama',
            model: 'nemotron-3-nano:30b-cloud',
          },
        ]),
      }),
      [ollamaProvider],
    );

    expect(service.getAvailableModels()).toHaveLength(2);
    expect(service.getDefaultModel()).toEqual({
      id: 'ollama-cloud',
      provider: 'ollama',
      model: 'nemotron-3-nano:30b-cloud',
    });
  });

  it('keeps the existing OLLAMA_MODEL fallback when no model registry is configured', () => {
    const service = new ModelRegistryService(
      new ConfigService({ OLLAMA_MODEL: 'existing-ollama-model' }),
      [ollamaProvider],
    );

    expect(service.getDefaultModel()).toEqual({
      id: 'existing-ollama-model',
      provider: 'ollama',
      model: 'existing-ollama-model',
    });
  });

  it('uses DEFAULT_MODEL_ID with the existing Ollama model as a compatibility fallback', () => {
    const service = new ModelRegistryService(
      new ConfigService({
        DEFAULT_MODEL_ID: 'primary-model',
        OLLAMA_MODEL: 'existing-ollama-model',
      }),
      [ollamaProvider],
    );

    expect(service.getDefaultModel()).toEqual({
      id: 'primary-model',
      provider: 'ollama',
      model: 'existing-ollama-model',
    });
  });

  it('resolves the provider registered for the selected model', () => {
    const service = new ModelRegistryService(
      new ConfigService({
        LLM_MODELS: JSON.stringify([
          { id: 'ollama-cloud', provider: 'ollama', model: 'cloud-model' },
        ]),
      }),
      [ollamaProvider],
    );

    expect(service.resolve('ollama-cloud')).toEqual({
      model: {
        id: 'ollama-cloud',
        provider: 'ollama',
        model: 'cloud-model',
      },
      provider: ollamaProvider,
    });
  });

  it('rejects unknown model IDs with a 400 validation error', () => {
    const service = new ModelRegistryService(
      new ConfigService({ OLLAMA_MODEL: 'existing-ollama-model' }),
      [ollamaProvider],
    );

    expect(() => service.resolve('missing-model')).toThrow();

    try {
      service.resolve('missing-model');
    } catch (error) {
      expect(error).toMatchObject({
        status: 400,
        response: {
          code: 'UNKNOWN_MODEL_ID',
          message: 'Unknown modelId: missing-model',
        },
      });
    }
  });
});
