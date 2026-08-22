import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const AEGIS_BASE_URL = process.env.AEGIS_BASE_URL ?? 'http://localhost:3000';

const server = new McpServer({
  name: 'aegis-tool-engine',
  version: '0.1.0',
});

async function getJson(path: string): Promise<unknown> {
  const url = `${AEGIS_BASE_URL}${path}`;
  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AEGIS API returned ${response.status}: ${body}`);
  }

  return response.json();
}

async function postJson(path: string): Promise<unknown> {
  const url = `${AEGIS_BASE_URL}${path}`;
  const response = await fetch(url, {
    method: 'POST',
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AEGIS API returned ${response.status}: ${body}`);
  }

  return response.json();
}


server.tool(
  'list_aegis_tools',
  'List enabled tools from the local AEGIS tool registry.',
  {},
  async () => {
    const tools = await getJson('/tools');

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(tools, null, 2),
        },
      ],
    };
  },
);

server.tool(
  'execute_aegis_tool',
  'Execute an enabled AEGIS tool by slug through the local tool pipeline.',
  {
    toolSlug: z.string().describe('The tool slug returned by list_aegis_tools.'),
  },
  async ({ toolSlug }) => {
    const result = await postJson(`/tools/${toolSlug}/execute`);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

server.tool(
  'get_recent_executions',
  'Get recent AEGIS tool execution records from Postgres.',
  {},
  async () => {
    const executions = await getJson('/tools/executions/recent');

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(executions, null, 2),
        },
      ],
    };
  },
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main ().catch((error) => {
    console.error(error);
    process.exit(1);
});
