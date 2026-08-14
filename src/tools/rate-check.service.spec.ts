import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import Redis from 'ioredis';
import { Tool } from '../db/schema';
import { RateCheckService } from './rate-check.service';

function makeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    id: 'e261c7bd-ccaa-4f38-b4ed-9093048ab180',
    name: 'JSONPlaceholder Todo Lookup',
    slug: 'jsonplaceholder_todo_lookup',
    type: 'http',
    description: 'Fetches a sample todo item from JSONPlaceholder',
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
    createdAt: new Date(),
    createdBy: 'rajanika',
    updatedAt: new Date(),
    updatedBy: 'rajanika',
    ...overrides,
  } as Tool;
}

describe('RateCheckService', () => {
  let redis: {
    zremrangebyscore: jest.Mock;
    zcard: jest.Mock;
    zrange: jest.Mock;
    zadd: jest.Mock;
    expire: jest.Mock;
  };

  let service: RateCheckService;

  beforeEach(() => {
    redis = {
      zremrangebyscore: jest.fn().mockResolvedValue(0),
      zcard: jest.fn().mockResolvedValue(0),
      zrange: jest.fn().mockResolvedValue([]),
      zadd: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    };

    service = new RateCheckService(redis as unknown as Redis);
  });

  it('allows the request when the tool is under the rate limit', async () => {
    redis.zcard.mockResolvedValue(0);

    const result = await service.check(makeTool());

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(3);
    expect(result.windowSeconds).toBe(60);
    expect(result.remaining).toBe(2);

    expect(redis.zremrangebyscore).toHaveBeenCalled();
    expect(redis.zcard).toHaveBeenCalledWith(
      'rate:tool:jsonplaceholder_todo_lookup',
    );
    expect(redis.zadd).toHaveBeenCalled();
    expect(redis.expire).toHaveBeenCalledWith(
      'rate:tool:jsonplaceholder_todo_lookup',
      60,
    );
  });

  it('blocks the request when the rate limit is exceeded', async () => {
    redis.zcard.mockResolvedValue(3);
    redis.zrange.mockResolvedValue(['request-1', `${Date.now()}`]);

    try {
      await service.check(makeTool());
      fail('Expected rate check to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);

      const httpError = error as HttpException;

      expect(httpError.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(httpError.getResponse()).toMatchObject({
        code: 'RATE_LIMIT_EXCEEDED',
        limit: 3,
        windowSeconds: 60,
        remaining: 0,
      });
    }

    expect(redis.zadd).not.toHaveBeenCalled();
  });

  it('throws INVALID_RATE_LIMIT when rate_limit is missing', async () => {
    const tool = makeTool({
      rateLimit: null,
    });

    await expect(service.check(tool)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws INVALID_RATE_LIMIT when rate_limit values are not numeric', async () => {
    const tool = makeTool({
      rateLimit: {
        maxRequests: '3',
        windowSeconds: 60,
      },
    });

    await expect(service.check(tool)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
