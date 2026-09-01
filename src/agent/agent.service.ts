import { BadRequestException, Injectable } from '@nestjs/common';
import { ToolPipelineService } from '../tools/tool-pipeline.service';
import { LlmPlannerService, LlmPlan } from './llm-planner.service';

type PipelineResult = Awaited<ReturnType<ToolPipelineService['run']>>;

@Injectable()
export class AgentService {
  constructor(
    private readonly toolPipelineService: ToolPipelineService,
    private readonly llmPlannerService: LlmPlannerService,) {}

  async query(message: string, createdBy = 'rajanika') {
      if (!message || typeof message !== 'string') {
        throw new BadRequestException({
           code: 'INVALID_AGENT_QUERY',
            message: 'message is required.',
        });
    }

    const llmPlan = await this.llmPlannerService.plan(message);
    
    if (llmPlan?.intent === 'weather_lookup' && llmPlan.location?.city) {
     return this.handleWeatherQueryWithLocation(
      llmPlan.location,
      createdBy,
      'ollama',
      llmPlan,
     );
    }

     if (this.isWeatherQuery(message)) {
       const location = this.extractLocation(message);

       return this.handleWeatherQueryWithLocation(
         location,
         createdBy,
          'rule_based_v1',
          llmPlan ?? undefined,
         );
     }
     
     throw new BadRequestException({
        code: 'UNSUPPORTED_AGENT_QUERY',
        message: 'This agent draft currently supports weather questions only.',
    });
}


  private async handleWeatherQueryWithLocation(
     location: { city: string; state?: string; country?: string },
     createdBy: string,
     planner: 'ollama' | 'rule_based_v1',
     llmPlan?: LlmPlan,
    ) {
        const geoResult = await this.toolPipelineService.run(
            'geo_lookup',
            {
                city: location.city,
                state: location.state ?? '',
                country: location.country ?? 'US',
            },
            createdBy,
        );

        const coordinates = this.extractCoordinates(geoResult);

        const weatherResult = await this.toolPipelineService.run(
            'weather_lookup',
            {
                city: location.city,
                state: location.state ?? '',
                country: location.country ?? 'US',
                latitude: coordinates.latitude,
                longitude: coordinates.longitude,
            },
            createdBy,
        );

         return {
            answer: this.extractSummary(weatherResult),
            intent: 'weather_lookup',
            planner,
            plannerReason: llmPlan?.reason,
            plannerConfidence: llmPlan?.confidence,
            steps: [
                {
                    order: 1,
                    toolSlug: 'geo_lookup',
                    purpose: 'Convert city/state/country into latitude and longitude.',
                    executionId: geoResult.record.executionId,
                    summary: this.extractSummary(geoResult),
                },
                {
                    order: 2,
                    toolSlug: 'weather_lookup',
                    purpose: 'Fetch current weather using latitude and longitude.',
                    executionId: weatherResult.record.executionId,
                    summary: this.extractSummary(weatherResult),
                },
            ],
        };
    }


  private isWeatherQuery(message: string) {
    return /weather|temperature|forecast/i.test(message);
  }

  private extractLocation(message: string) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('new york')) {
      return {
        city: 'New York',
        state: 'NY',
        country: 'US',
      };
    }

    if (lowerMessage.includes('portland')) {
      return {
        city: 'Portland',
        state: 'OR',
        country: 'US',
      };
    }

    if (lowerMessage.includes('hillsboro')) {
      return {
        city: 'Hillsboro',
        state: 'OR',
        country: 'US',
      };
    }

    throw new BadRequestException({
      code: 'LOCATION_NOT_SUPPORTED_YET',
      message:
        'This first agent draft supports New York, Portland, and Hillsboro weather queries.',
    });
  }

  private extractCoordinates(result: PipelineResult) {
    const normalized = result.transformed.normalized;

    if (
      !normalized ||
      typeof normalized !== 'object' ||
      !('latitude' in normalized) ||
      !('longitude' in normalized)
    ) {
      throw new BadRequestException({
        code: 'INVALID_GEO_RESULT',
        message: 'Geo lookup did not return latitude and longitude.',
      });
    }

    return {
      latitude: (normalized as Record<string, unknown>).latitude,
      longitude: (normalized as Record<string, unknown>).longitude,
    };
  }

  private extractSummary(result: PipelineResult) {
    return result.transformed.summary;
  }
}
