import { Controller, Get, Header } from '@nestjs/common';

@Controller()
export class DemoController {
  @Get('demo')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getDemoPage() {
    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>AEGIS Demo Console</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; background: #f7f7f8; color: #1f2937; }
    .card { background: white; border: 1px solid #ddd; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
    textarea { width: 100%; height: 90px; font-size: 16px; padding: 12px; border-radius: 8px; border: 1px solid #ccc; }
    button { padding: 10px 14px; border: 0; border-radius: 8px; cursor: pointer; margin: 6px 6px 6px 0; }
    .primary { background: #111827; color: white; }
    .example { background: #e5e7eb; }
    pre { white-space: pre-wrap; background: #111827; color: #e5e7eb; padding: 14px; border-radius: 8px; overflow-x: auto; }
    .step { border-left: 4px solid #111827; padding-left: 12px; margin: 12px 0; }
    .muted { color: #6b7280; }
  </style>
</head>
<body>
  <h1>AEGIS Demo Console</h1>
  <p class="muted">Ask a natural-language question. The agent will choose approved tools and show the execution trace.</p>

  <div class="card">
    <h2>Ask AEGIS</h2>
    <textarea id="message">Show me the last 5 tool executions.</textarea>
    <br />
    <button class="primary" onclick="runQuery()">Run</button>
    <button class="example" onclick="setExample('Show me the last 5 tool executions.')">Recent executions</button>
    <button class="example" onclick="setExample('How many times was weather_lookup executed?')">Tool count</button>
    <button class="example" onclick="setExample('What is the average latency by tool?')">Average latency</button>
    <button class="example" onclick="setExample('Is New York warmer than Atlanta?')">Weather comparison</button>
    <button class="example" onclick="setExample('Delete all tool executions.')">Safety test</button>
  </div>

  <div class="card">
    <h2>Answer</h2>
    <pre id="answer">No query run yet.</pre>
  </div>

  <div class="card">
    <h2>Tool Steps</h2>
    <div id="steps" class="muted">No steps yet.</div>
  </div>

  <div class="card">
    <h2>Raw Response</h2>
    <pre id="raw">No response yet.</pre>
  </div>

  <script>
    function setExample(text) {
      document.getElementById('message').value = text;
    }

    async function runQuery() {
      const message = document.getElementById('message').value.trim();
      const answer = document.getElementById('answer');
      const steps = document.getElementById('steps');
      const raw = document.getElementById('raw');

      if (!message) {
        answer.textContent = 'Please enter a question.';
        return;
      }

      answer.textContent = 'Running...';
      steps.textContent = 'Waiting for tool calls...';
      raw.textContent = '';

      try {
        const response = await fetch('/agent/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, createdBy: 'demo-ui' })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(JSON.stringify(data, null, 2));
        }

        answer.textContent = data.answer || 'No answer returned.';
        raw.textContent = JSON.stringify(data, null, 2);
        renderSteps(data.steps || []);
      } catch (error) {
        answer.textContent = 'Request failed.';
        steps.textContent = '';
        raw.textContent = error.message || String(error);
      }
    }

    function renderSteps(stepList) {
      const steps = document.getElementById('steps');
      steps.innerHTML = '';

      if (!stepList.length) {
        steps.textContent = 'No tool calls were made.';
        return;
      }

      for (const step of stepList) {
        const div = document.createElement('div');
        div.className = 'step';

        const lines = [
          'Step: ' + step.order,
          'Function: ' + step.functionName,
          step.toolSlug ? 'AEGIS Tool: ' + step.toolSlug : null,
          step.executionId ? 'Execution ID: ' + step.executionId : null,
          step.summary ? 'Summary: ' + step.summary : null,
          step.arguments && step.arguments.sql ? 'SQL: ' + step.arguments.sql : null
        ].filter(Boolean);

        div.textContent = lines.join('\\n');
        steps.appendChild(div);
      }
    }
  </script>
</body>
</html>
`;
  }
}
