import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { NewTool, tools } from './schema';
import { eq } from 'drizzle-orm';

const seedTools: NewTool[] = [
  {
    name: 'JSONPlaceholder Todo Lookup',
    slug: 'todo_lookup',
    type: 'http',
    description: 'Fetches a sample todo item from JSONPlaceholder.',
    config: {
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/todos/1',
      headers: {},
    },
    rateLimit: {
      maxRequests: 3,
      windowSeconds: 60,
    },
    timeoutMs: 5000,
    enabled: true,
    createdBy: 'rajanika',
    updatedBy: 'rajanika',
  },
  {
    name: 'Hillsboro Weather Lookup',
    slug: 'weather_now',
    type: 'http',
    description: 'Fetches current weather conditions for Hillsboro using Open-Meteo.',
    config: {
      method: 'GET',
      url: 'https://api.open-meteo.com/v1/forecast?latitude=45.5229&longitude=-122.9898&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto',
      headers: {},
    },
    rateLimit: {
      maxRequests: 3,
      windowSeconds: 60,
    },
    timeoutMs: 5000,
    enabled: true,
    createdBy: 'rajanika',
    updatedBy: 'rajanika',
  },
  {
    name: 'Permit Status Sample',
    slug: 'permit_status',
    type: 'http',
    description: 'Fetches a sample government-style permit status from the local mock API.',
    config: {
      method: 'GET',
      url: 'http://localhost:3000/mock/permit-status/sample',
      headers: {},
    },
    rateLimit: {
      maxRequests: 3,
      windowSeconds: 60,
    },
    timeoutMs: 5000,
    enabled: true,
    createdBy: 'rajanika',
    updatedBy: 'rajanika',
  },
  {
    name: 'Resource Allocation Sample',
    slug: 'resource_check',
    type: 'http',
    description: 'Fetches a sample resource allocation verification result from the local mock API.',
    config: {
      method: 'GET',
      url: 'http://localhost:3000/mock/resource-allocation/project-phoenix',
      headers: {},
    },
    rateLimit: {
      maxRequests: 3,
      windowSeconds: 60,
    },
    timeoutMs: 5000,
    enabled: true,
    createdBy: 'rajanika',
    updatedBy: 'rajanika',
  },
  {
     name: 'Geolocation Lookup',
     slug: 'geo_lookup',
     type: 'http',
     description: 'Converts a city, state, and country into latitude and longitude using OpenWeather.',
     config: {
        method: 'GET',
        url: 'https://api.openweathermap.org/geo/1.0/direct?q={{city}},{{state}},{{country}}&limit=1&appid={{env.OPENWEATHER_API_KEY}}',
        headers: {},
    },
    rateLimit: {
        maxRequests: 5,
        windowSeconds: 60,
    },
    timeoutMs: 5000,
    enabled: true,
    createdBy: 'rajanika',
    updatedBy: 'rajanika',
 },
 {
     name: 'Weather Lookup',
     slug: 'weather_lookup',
     type: 'http',
     description: 'Fetches current weather using latitude and longitude.',
     config: {
        method: 'GET',
        url: 'https://api.open-meteo.com/v1/forecast?latitude={{latitude}}&longitude={{longitude}}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto',
        headers: {},
    },
    rateLimit: {
     maxRequests: 5,
     windowSeconds: 60,
     },
     timeoutMs: 5000,
     enabled: true,
     createdBy: 'rajanika',
    updatedBy: 'rajanika',
    },
];

const deprecatedSlugs = [
    'jsonplaceholder_todo_lookup',
    'weather_hillsboro_current',
    'permit_status_sample',
    'resource_allocation_sample',
]

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to seed tools.');
  }

  const client = postgres(databaseUrl);
  const db = drizzle(client);

  try {
    for (const tool of seedTools) {
      await db
        .insert(tools)
        .values(tool)
        .onConflictDoUpdate({
          target: tools.slug,
          set: {
            name: tool.name,
            type: tool.type,
            description: tool.description,
            config: tool.config,
            rateLimit: tool.rateLimit,
            timeoutMs: tool.timeoutMs,
            enabled: tool.enabled,
            updatedBy: tool.updatedBy,
            updatedAt: new Date(),
          },
        });

      console.log(`Seeded tool: ${tool.slug}`);
    }

    for (const slug of deprecatedSlugs) {
        await db.update(tools)
        .set({
            enabled: false,
            updatedBy: 'rajanika',
            updatedAt: new Date(),
        })
        .where(eq(tools.slug, slug));
    console.log(`Disabled old tool slug: ${slug}`);
    }

    console.log('Tool seeding complete.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
