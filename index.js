import { getSharedClient } from './lib/client.js';
import { createNovelAITools } from './lib/tools.js';
import { registerNovelAiRoutes } from './lib/api.js';
import { archiveManager } from './lib/archive.js';
import { thumbService } from './lib/thumb.js';

export const name = 'dsh-nai5-studio';
export const inject = ['tools'];

const registeredWebServers = new WeakSet();
let activeInstances = 0;

export function apply(ctx, config) {
  activeInstances++;
  const client = getSharedClient(config || {});
  const tools = createNovelAITools(client);

  for (const tool of tools) {
    ctx.tools.register(tool);
  }

  ctx.inject(['webServer'], (webCtx) => {
    if (!webCtx?.webServer || registeredWebServers.has(webCtx.webServer)) return;
    registeredWebServers.add(webCtx.webServer);
    registerNovelAiRoutes(webCtx, client);
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
