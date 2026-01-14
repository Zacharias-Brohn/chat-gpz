/**
 * Tool definitions and registry for Ollama function calling
 */

import { Tool } from 'ollama';
// Import and register all tools
import { calculatorHandler, calculatorTool } from './calculator';
import { codeExecutionHandler, codeExecutionTool } from './code-execution';
import { dateTimeHandler, dateTimeTool } from './datetime';
import { fileReadHandler, fileReadTool, fileWriteHandler, fileWriteTool } from './file-operations';
import { imageGenerationHandler, imageGenerationTool } from './image-generation';
import { ToolHandler, ToolResult } from './types';
import { urlFetchHandler, urlFetchTool } from './url-fetch';
import { weatherHandler, weatherTool } from './weather';
import { webSearchHandler, webSearchTool } from './web-search';

// Re-export types
export type { ToolHandler, ToolResult } from './types';

// Registry of tool handlers
const toolHandlers: Map<string, ToolHandler> = new Map();

/**
 * Register a tool handler
 */
export function registerTool(name: string, handler: ToolHandler): void {
  toolHandlers.set(name, handler);
}

/**
 * Execute a tool by name with given arguments
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const handler = toolHandlers.get(name);
  if (!handler) {
    return {
      success: false,
      error: `Unknown tool: ${name}`,
    };
  }

  try {
    return await handler(args);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error executing tool',
    };
  }
}

/**
 * Get all registered tool names
 */
export function getRegisteredTools(): string[] {
  return Array.from(toolHandlers.keys());
}

// Register all tool handlers
registerTool('calculator', calculatorHandler);
registerTool('get_current_datetime', dateTimeHandler);
registerTool('fetch_url', urlFetchHandler);
registerTool('web_search', webSearchHandler);
registerTool('execute_code', codeExecutionHandler);
registerTool('read_file', fileReadHandler);
registerTool('write_file', fileWriteHandler);
registerTool('get_weather', weatherHandler);
registerTool('generate_image', imageGenerationHandler);

// Export all tool definitions for Ollama
export const allTools: Tool[] = [
  calculatorTool,
  dateTimeTool,
  urlFetchTool,
  webSearchTool,
  codeExecutionTool,
  fileReadTool,
  fileWriteTool,
  weatherTool,
  imageGenerationTool,
];

// Export individual tools for selective use
export {
  calculatorTool,
  dateTimeTool,
  urlFetchTool,
  webSearchTool,
  codeExecutionTool,
  fileReadTool,
  fileWriteTool,
  weatherTool,
  imageGenerationTool,
};
