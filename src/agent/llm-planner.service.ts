import { Injectable } from '@nestjs/common';
import type { LlmMessage } from './llm-provider.interface';
import { ModelRegistryService } from './model-registry.service';

export type LlmPlan = {
  intent: 'weather_lookup' | 'unsupported';
  location?: {
    city: string;
    state?: string;
    country?: string;
  };
  confidence: number;
  reason: string;
};

@Injectable()
export class LlmPlannerService {
  constructor(private readonly modelRegistryService: ModelRegistryService) {}

  async plan(message: string): Promise<LlmPlan | null> {
    const provider = process.env.LLM_PROVIDER ?? 'rule_based';

    if (provider !== 'ollama') {
      return null;
    }

    return this.planWithOllama(message);
  }

  private async planWithOllama(message: string): Promise<LlmPlan> {
    const messages: LlmMessage[] = [
      {
        role: 'system',
        content: `
You are the planner for a local AEGIS mini tool execution engine.

Your only job is to classify the user's request and extract tool inputs.

Supported intent:
- weather_lookup

Return only valid JSON. No markdown. No extra text.

Required JSON shape:
{
  "intent": "weather_lookup" | "unsupported",
  "location": {
    "city": "string",
    "state": "string",
    "country": "string"
  },
  "confidence": 0.0,
  "reason": "string"
}

Rules:
- If the user asks about weather, temperature, forecast, rain, humidity, wind, or current conditions, use intent "weather_lookup".
- Extract city, state, and country when possible.
- For US locations, use two-letter state abbreviation when obvious.
- If country is not mentioned and the location is in the US, use "US".
- If the request is not about weather, return intent "unsupported".
- If the city is unclear, return intent "unsupported".
        `.trim(),
      },
      {
        role: 'user',
        content: message,
      },
    ];

    const selection = this.modelRegistryService.resolve();
    const result = await selection.provider.chat({
      model: selection.model.model,
      messages,
      responseFormat: 'json',
    });
    const text = result.message.content?.trim();

    if (!text) {
      return {
        intent: 'unsupported',
        confidence: 0,
        reason: 'Ollama returned an empty planner response.',
      };
    }

    return this.parsePlan(text);
  }

  private parsePlan(text: string): LlmPlan {
    try {
      const parsed = JSON.parse(text) as Partial<LlmPlan>;

      if (
        parsed.intent !== 'weather_lookup' &&
        parsed.intent !== 'unsupported'
      ) {
        return {
          intent: 'unsupported',
          confidence: 0,
          reason: 'Planner returned an unsupported intent.',
        };
      }

      return {
        intent: parsed.intent,
        location: parsed.location,
        confidence:
          typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        reason:
          typeof parsed.reason === 'string'
            ? parsed.reason
            : 'Planner returned a valid intent.',
      };
    } catch {
      return {
        intent: 'unsupported',
        confidence: 0,
        reason: 'Planner response could not be parsed as JSON.',
      };
    }
  }
}
