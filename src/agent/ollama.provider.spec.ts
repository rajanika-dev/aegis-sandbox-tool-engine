import { ConfigService } from '@nestjs/config';
import { OllamaProvider } from './ollama.provider';

describe('OllamaProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('preserves the Ollama chat request shape for tool-calling', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          message: { role: 'assistant', content: 'Done', tool_calls: [] },
        }),
    } as Response);
    const provider = new OllamaProvider(
      new ConfigService({
        OLLAMA_BASE_URL: 'https://ollama.example/',
      }),
    );

    const result = await provider.chat({
      model: 'test-model',
      messages: [{ role: 'user', content: 'Hello' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'test_tool',
            description: 'A test tool.',
            parameters: { type: 'object' },
          },
        },
      ],
      temperature: 0,
    });

    expect(result.message.content).toBe('Done');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://ollama.example/api/chat',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'test-model',
          stream: false,
          messages: [{ role: 'user', content: 'Hello' }],
          tools: [
            {
              type: 'function',
              function: {
                name: 'test_tool',
                description: 'A test tool.',
                parameters: { type: 'object' },
              },
            },
          ],
          options: { temperature: 0 },
        }),
      }),
    );
  });
});
