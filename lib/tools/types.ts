/**
 * Tool types and interfaces
 */

// Tool execution result
export interface ToolResult {
  success: boolean;
  result?: string;
  error?: string;
}

// Tool handler function type
export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;
