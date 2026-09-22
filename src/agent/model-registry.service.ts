import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type LlmModelDefinition = {
  id: string;
  provider: string;
  model: string;
};

const DEFAULT_OLLAMA_MODEL = 'qwen2.5:1.5b';

@Injectable()
export class ModelRegistryService {
  private readonly models: LlmModelDefinition[];
  private readonly defaultModelId: string;

  constructor(private readonly configService: ConfigService) {
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
      throw new Error(`Configured model was not found: ${modelId}`);
    }

    return { ...model };
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
