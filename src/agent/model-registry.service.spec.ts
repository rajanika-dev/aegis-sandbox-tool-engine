import { ConfigService } from '@nestjs/config';
import { ModelRegistryService } from './model-registry.service';

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
    );

    expect(service.getDefaultModel()).toEqual({
      id: 'primary-model',
      provider: 'ollama',
      model: 'existing-ollama-model',
    });
  });
});
