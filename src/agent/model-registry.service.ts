import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLM_PROVIDERS } from './llm-provider.constants';
import type { LlmProvider } from './llm-provider.interface';

export type LlmModelDefinition = {
  id: string;
  provider: string;
  model: string;
};

export type LlmProviderSelection = {
  model: LlmModelDefinition;
  provider: LlmProvider;
};

const DEFAULT_OLLAMA_MODEL = 'qwen2.5:1.5b';

@Injectable()
export class ModelRegistryService {
  private readonly models: LlmModelDefinition[];
  private readonly defaultModelId: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(LLM_PROVIDERS) private readonly providers: LlmProvider[],
  ) {
    this.models = this.readModels();
    this.defaultModelId =
      this.configService.get<string>('DEFAULT_MODEL_ID') ?? this.models[0].id;
  }

  getAvailableModels(): LlmModelDefinition[] {
    return this.models.map((model) => ({ ...model }));
  }

  getDefaultModel(): LlmModelDefinition {
    return this.getModel(this.defaultModelId);
  }

  getModel(modelId: string): LlmModelDefinition {
    const model = this.models.find((candidate) => candidate.id === modelId);

    if (!model) {
      throw new BadRequestException({
        code: 'UNKNOWN_MODEL_ID',
        message: `Unknown modelId: ${modelId}`,
      });
    }

    return { ...model };
  }

  resolve(modelId?: string): LlmProviderSelection {
    const model =
      modelId === undefined ? this.getDefaultModel() : this.getModel(modelId);
    const provider = this.providers.find(
      (candidate) => candidate.id === model.provider,
    );

    if (!provider) {
      throw new BadRequestException({
        code: 'MODEL_PROVIDER_NOT_CONFIGURED',
        message: `No provider is configured for modelId "${model.id}".`,
        provider: model.provider,
      });
    }

    return { model, provider };
  }

  private readModels(): LlmModelDefinition[] {
    const configuredModels = this.configService.get<string>('LLM_MODELS');

    if (!configuredModels) {
      const ollamaModel =
        this.configService.get<string>('OLLAMA_MODEL') ?? DEFAULT_OLLAMA_MODEL;
      const modelId =
        this.configService.get<string>('DEFAULT_MODEL_ID') ?? ollamaModel;

      return [
        {
          id: modelId,
          provider: 'ollama',
          model: ollamaModel,
        },
      ];
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(configuredModels);
    } catch {
      throw new Error('LLM_MODELS must be valid JSON.');
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('LLM_MODELS must be a non-empty JSON array.');
    }

    return parsed.map((model, index) => this.validateModel(model, index));
  }

  private validateModel(value: unknown, index: number): LlmModelDefinition {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`LLM_MODELS entry ${index} must be an object.`);
    }

    const model = value as Record<string, unknown>;

    if (
      typeof model.id !== 'string' ||
      !model.id.trim() ||
      typeof model.provider !== 'string' ||
      !model.provider.trim() ||
      typeof model.model !== 'string' ||
      !model.model.trim()
    ) {
      throw new Error(
        `LLM_MODELS entry ${index} must include non-empty id, provider, and model values.`,
      );
    }

    return {
      id: model.id.trim(),
      provider: model.provider.trim(),
      model: model.model.trim(),
    };
  }
}
