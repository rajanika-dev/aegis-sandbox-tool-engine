import { AgentController } from './agent.controller';

describe('AgentController request compatibility', () => {
  it('continues to accept the existing message request body and forwards modelId', async () => {
    const agentService = {
      query: jest.fn().mockResolvedValue({
        answer: 'There are 3 submissions.',
        planner: 'ollama_function_calling',
        modelId: 'ollama-nemotron',
        provider: 'ollama',
        steps: [],
      }),
    };
    const recorder = {
      record: jest.fn().mockResolvedValue({ requestId: 'request-1' }),
      findRecent: jest.fn(),
    };
    const controller = new AgentController(
      agentService as never,
      recorder as never,
    );

    const result = await controller.query(
      {
        message: 'How many submissions exist?',
        modelId: 'ollama-nemotron',
      },
      {},
    );

    expect(agentService.query).toHaveBeenCalledWith(
      'How many submissions exist?',
      'demo-user',
      'ollama-nemotron',
    );
    expect(recorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'How many submissions exist?',
        modelId: 'ollama-nemotron',
      }),
    );
    expect(result).toMatchObject({
      requestId: 'request-1',
      modelId: 'ollama-nemotron',
      provider: 'ollama',
    });
  });

  it('accepts question as an alias while leaving message as the legacy field', async () => {
    const agentService = {
      query: jest.fn().mockResolvedValue({
        answer: 'Done',
        planner: 'ollama_function_calling',
        modelId: 'ollama-nemotron',
        provider: 'ollama',
        steps: [],
      }),
    };
    const recorder = {
      record: jest.fn().mockResolvedValue({ requestId: 'request-2' }),
      findRecent: jest.fn(),
    };
    const controller = new AgentController(
      agentService as never,
      recorder as never,
    );

    await controller.query({ question: 'How many submissions exist?' }, {});

    expect(agentService.query).toHaveBeenCalledWith(
      'How many submissions exist?',
      'demo-user',
      undefined,
    );
  });

  it('exposes the compare endpoint through AgentService', async () => {
    const agentService = {
      query: jest.fn(),
      compare: jest.fn().mockResolvedValue({
        question: 'How many submissions exist?',
        totalLatencyMs: 3,
        results: [],
      }),
    };
    const recorder = {
      record: jest.fn(),
      findRecent: jest.fn(),
    };
    const controller = new AgentController(
      agentService as never,
      recorder as never,
    );

    const result = await controller.compare({
      question: 'How many submissions exist?',
      modelIds: ['ollama-nemotron'],
    });

    expect(agentService.compare).toHaveBeenCalledWith(
      'How many submissions exist?',
      ['ollama-nemotron'],
    );
    expect(result).toMatchObject({ totalLatencyMs: 3 });
  });
});
