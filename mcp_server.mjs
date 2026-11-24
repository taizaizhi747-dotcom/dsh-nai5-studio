#!/usr/bin/env node
/**
 * Stdio MCP Server adapter for NovelAI Diffusion V5 native engine & optional Danbooru/Codex libraries.
 * Reuses the core modules in ./lib/ directly so DSH and external MCP clients share a single engine.
 */
import readline from 'node:readline';

// Protect JSON-RPC stdout from any accidental console.log inside dependencies.
const rawStdoutWrite = process.stdout.write.bind(process.stdout);
const writeErr = (...args) => process.stderr.write(`${args.map(String).join(' ')}\n`);
console.log = writeErr;
console.info = writeErr;
console.warn = writeErr;
console.debug = writeErr;

import { getSharedClient } from './lib/client.js';
import { createNovelAITools } from './lib/tools.js';

const SERVER_INFO = {
  name: 'dsh-nai5-studio',
  version: '2.0.1'
};

function sendMessage(payload) {
  rawStdoutWrite(`${JSON.stringify(payload)}\n`);
}

function sendResult(id, result) {
  sendMessage({ jsonrpc: '2.0', id, result });
}

function sendError(id, code, message) {
  sendMessage({ jsonrpc: '2.0', id, error: { code, message: String(message) } });
}

function toMcpToolDescriptor(tool) {
  return {
    name: tool.name,
    description: tool.description || '',
    inputSchema: tool.parameters || { type: 'object', properties: {} }
  };
}

function formatToolOutput(tool, args, value) {
  if (tool.output && typeof tool.output.render === 'function') {
    const rendered = tool.output.render(args, value);
    if (Array.isArray(rendered) && rendered.length > 0) {
      return rendered.map((item) => ({
        type: 'text',
        text: typeof item?.text === 'string' ? item.text : JSON.stringify(item)
      }));
    }
  }
  return [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }];
}

function createDispatcher() {
  const client = getSharedClient();
  const primaryTools = createNovelAITools(client);
  const toolMap = new Map(primaryTools.map((t) => [t.name, t]));
  const toolDescriptors = primaryTools.map(toMcpToolDescriptor);

  return async function handleRequest(req) {
    const { id, method, params } = req || {};
    const hasId = id !== undefined && id !== null;

    if (typeof method === 'string' && method.startsWith('notifications/')) {
      return;
    }

    if (method === 'initialize') {
      const protocolVersion = typeof params?.protocolVersion === 'string' && params.protocolVersion
        ? params.protocolVersion
        : '2024-11-05';
      if (hasId) {
        sendResult(id, {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO
        });
      }
      return;
    }

    if (method === 'ping') {
      if (hasId) sendResult(id, {});
      return;
    }

    if (method === 'tools/list') {
      if (hasId) sendResult(id, { tools: toolDescriptors });
      return;
    }

    if (method === 'tools/call') {
      const toolName = params?.name;
      const args = (params?.arguments && typeof params.arguments === 'object') ? params.arguments : {};
      const tool = toolMap.get(toolName);
      if (!tool) {
        if (hasId) sendError(id, -32601, `Tool not found: ${toolName}`);
        return;
      }
      try {
        const result = await tool.execute(args);
        if (hasId) {
          sendResult(id, {
            content: formatToolOutput(tool, args, result),
            isError: false
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (hasId) {
          sendResult(id, {
            content: [{ type: 'text', text: msg }],
            isError: true
          });
        }
      }
      return;
    }

    if (hasId) {
      sendError(id, -32601, `Method not found: ${method}`);
    }
  };
}

function main() {
  const dispatch = createDispatcher();
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity
  });

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let req;
    try {
      req = JSON.parse(trimmed);
    } catch (err) {
      sendError(null, -32700, `Parse error: ${err.message}`);
      return;
    }
    dispatch(req).catch((err) => {
      const id = req?.id;
      if (id !== undefined && id !== null) {
        sendError(id, -32603, err?.message || String(err));
      }
    });
  });

  const shutdown = () => process.exit(0);
  rl.on('close', shutdown);
  process.stdin.on('end', shutdown);
}

main();
