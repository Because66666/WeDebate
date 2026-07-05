import type { Tool, ToolRegistry } from '../../types';
import { duckduckgoSearchTool } from './duckduckgo-search';
import { webFetchTool } from './web-fetch';

export function createToolRegistry(): ToolRegistry {
  const tools = new Map<string, Tool>();

  // 注册预置工具
  tools.set(duckduckgoSearchTool.name, duckduckgoSearchTool);
  tools.set(webFetchTool.name, webFetchTool);

  return {
    tools,
    register: (tool: Tool) => {
      tools.set(tool.name, tool);
    },
    unregister: (name: string) => {
      tools.delete(name);
    },
    get: (name: string) => tools.get(name),
    getAll: () => Array.from(tools.values()),
  };
}
