import { Injectable } from '@nestjs/common';
import { Tool } from '../db/schema';

type HttpExecutionResult = {
  status: number;
  ok: boolean;
  data: unknown;
};

type TransformResult = {
  normalized: unknown;
  summary: string;
};

@Injectable()
export class ToolTransformService {
  transform(
    tool: Tool,
    execution: HttpExecutionResult,
    input: Record<string, unknown> = {},
  ): TransformResult {

    const data = execution.data;

    if (tool.slug === 'geo_lookup') {
      return this.transformGeoLookup(data);
    }

    if (
      ['weather_now', 'weather_lookup', 'weather_hillsboro_current'].includes(
        tool.slug,
      )
    ) {
        return this.transformWeather(data, input);
      }


    if (['permit_status', 'permit_status_sample'].includes(tool.slug)) {
      return this.transformPermitStatus(data);
    }

    if (['resource_check', 'resource_allocation_sample'].includes(tool.slug)) {
      return this.transformResourceAllocation(data);
    }

    if (this.isJsonPlaceholderTodo(data)) {
      return {
        normalized: {
          id: data.id,
          title: data.title,
          completed: data.completed,
          status: data.completed ? 'completed' : 'open',
        },
        summary: `Todo ${data.id} is ${data.completed ? 'completed' : 'not completed'}.`,
      };
    }

    return {
      normalized: data,
      summary: 'Tool response was returned without a custom transform.',
    };
  }

  private transformGeoLookup(data: unknown): TransformResult {
   if (!Array.isArray(data) || data.length === 0 || !this.isRecord(data[0])) {
      return {
        normalized: {
          found: false,
        },
        summary: 'No matching location was found.',
      };
    }

    const location = data[0];

    return {
      normalized: {
        found: true,
        name: location.name,
        state: location.state,
        country: location.country,
       latitude: location.lat,
        longitude: location.lon,
      },
      summary: `${this.valueOrUnknown(location.name)}, ${this.valueOrUnknown(
        location.state,
      )}, ${this.valueOrUnknown(location.country)} is located at latitude ${this.valueOrUnknown(
        location.lat,
      )} and longitude ${this.valueOrUnknown(location.lon)}.`,
    };
  }

  
  private transformWeather(
    data: unknown,
    input: Record<string, unknown>,
  ): TransformResult {
    if (!this.isRecord(data) || !this.isRecord(data.current)) {
      return {
        normalized: data,
        summary: 'Weather response was returned, but it did not match the expected shape.',
      };
    }

     const current = data.current;
     const units = this.isRecord(data.current_units) ? data.current_units : {};

     const location = this.formatWeatherLocation(input);

     const temperature = current.temperature_2m;
     const humidity = current.relative_humidity_2m;
     const windSpeed = current.wind_speed_10m;
      const weatherCode = current.weather_code;
     const observedAt = current.time;

     const temperatureUnit = this.valueOrUnknown(units.temperature_2m);
     const windSpeedUnit = this.valueOrUnknown(units.wind_speed_10m);

     return {
        normalized: {
        location,
        temperature,
        temperatureUnit,
        humidityPercent: humidity,
        windSpeed,
        windSpeedUnit,
        weatherCode,
        observedAt,
      },
      summary: `${location} weather is ${this.valueOrUnknown(
       temperature,
      )}${temperatureUnit}, humidity is ${this.valueOrUnknown(
       humidity,
      )}%, and wind speed is ${this.valueOrUnknown(windSpeed)} ${windSpeedUnit}.`,
     };
    }

  private formatWeatherLocation(input: Record<string, unknown>): string {
   const city = input.city;
   const state = input.state;
   const country = input.country;

   if (city && state) {
      return `${String(city)}, ${String(state)}`;
   }

   if (city && country) {
     return `${String(city)}, ${String(country)}`;
   }

   if (city) {
     return String(city);
   }

   const latitude = input.latitude;
   const longitude = input.longitude;

   if (latitude && longitude) {
     return `lat ${String(latitude)}, lon ${String(longitude)}`;
   }

   return 'Hillsboro, OR';
  }



  private transformPermitStatus(data: unknown): TransformResult {
    if (!this.isRecord(data)) {
      return {
        normalized: data,
        summary: 'Permit response was returned, but it did not match the expected shape.',
      };
    }

    return {
      normalized: {
        permitId: data.permitId,
        status: data.status,
        nextStep: data.nextStep,
        lastUpdated: data.lastUpdated,
        sourceSystem: data.sourceSystem,
      },
      summary: `Permit ${this.valueOrUnknown(
        data.permitId,
      )} is currently ${this.valueOrUnknown(
        data.status,
      )}. Next step: ${this.valueOrUnknown(data.nextStep)}.`,
    };
  }

  private transformResourceAllocation(data: unknown): TransformResult {
    if (!this.isRecord(data)) {
      return {
        normalized: data,
        summary:
          'Resource allocation response was returned, but it did not match the expected shape.',
      };
    }

    const mismatches = Array.isArray(data.mismatches) ? data.mismatches : [];

    return {
      normalized: {
        projectKey: data.projectKey,
        projectName: data.projectName,
        activeContributors: data.activeContributors,
        verificationStatus: data.verificationStatus,
        mismatchCount: mismatches.length,
        sourceSystem: data.sourceSystem,
      },
      summary: `${this.valueOrUnknown(
        data.projectName,
      )} has ${this.valueOrUnknown(
        data.activeContributors,
      )} active contributors and mismatches.lengthverificationmismatch{
        mismatches.length === 1 ? '' : 'es'
      }.`,
    };
  }

  private isJsonPlaceholderTodo(value: unknown): value is {
    userId: number;
    id: number;
    title: string;
    completed: boolean;
  } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      'title' in value &&
      'completed' in value
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private valueOrUnknown(value: unknown): string {
    if (value === undefined || value === null || value === '') {
      return 'unknown';
    }

    return String(value);
  }
}
