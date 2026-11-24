import { getSharedClient } from './lib/client.js';
import { createNovelAITools } from './lib/tools.js';
import { registerNovelAiRoutes } from './lib/api.js';
import { archiveManager } from './lib/archive.js';
import { thumbService } from './lib/thumb.js';

export const name = 'dsh-nai5-studio';

const registeredWebServers = new WeakSet();
const registeredToolRegistries = new WeakSet();
let activeInstances = 0;

export function apply(ctx, config) {
  activeInstances++;
  const client = getSharedClient(config || {});
  const tools = createNovelAITools(client);

  ctx.inject(['tools'], (toolCtx) => {
    const registry = toolCtx?.tools;
    if (!registry || registeredToolRegistries.has(registry)) return;
    registeredToolRegistries.add(registry);
    for (const tool of tools) {
      registry.register(tool);
    }
    const cleanupTools = () => registeredToolRegistries.delete(registry);
    if (typeof toolCtx.effect === 'function') {
      toolCtx.effect(() => cleanupTools, 'novelai:tools-cleanup');
    }
    if (typeof toolCtx.on === 'function') {
      toolCtx.on('dispose', cleanupTools);
    }
  });

  ctx.inject(['webServer'], (webCtx) => {
    const ws = webCtx?.webServer;
    if (!ws || registeredWebServers.has(ws)) return;
    registeredWebServers.add(ws);
    registerNovelAiRoutes(webCtx, client);
    const cleanupServer = () => registeredWebServers.delete(ws);
    if (typeof webCtx.effect === 'function') {
      webCtx.effect(() => cleanupServer, 'novelai:webserver-cleanup');
    }
    if (typeof webCtx.on === 'function') {
      webCtx.on('dispose', cleanupServer);
    }
  });

  if (typeof ctx.on === 'function') {
    ctx.on('dispose', () => {
      activeInstances = Math.max(0, activeInstances - 1);
      if (activeInstances === 0) {
        archiveManager.dispose();
        thumbService.dispose();
      }
    });
  }
}
