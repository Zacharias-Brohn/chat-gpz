/**
 * File Operations tools - read and write files with path restrictions
 */

import { promises as fs } from 'fs';
import path from 'path';
import { Tool } from 'ollama';
import { ToolHandler, ToolResult } from './types';

// Configurable allowed directories (can be set via environment variable)
const ALLOWED_DIRECTORIES = (process.env.TOOL_FILE_ALLOWED_PATHS || '/tmp,./workspace')
  .split(',')
  .map((p) => path.resolve(p.trim()));

// Maximum file size for reading (5MB)
const MAX_READ_SIZE = 5 * 1024 * 1024;

// Maximum file size for writing (1MB)
const MAX_WRITE_SIZE = 1 * 1024 * 1024;

/**
 * Check if a path is within allowed directories
 */
function isPathAllowed(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return ALLOWED_DIRECTORIES.some((allowed) => resolved.startsWith(allowed));
}

export const fileReadTool: Tool = {
  type: 'function',
  function: {
    name: 'read_file',
    description: `Read the contents of a file. For security, only files in these directories can be accessed: ${ALLOWED_DIRECTORIES.join(', ')}`,
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to read',
        },
        encoding: {
          type: 'string',
          enum: ['utf-8', 'base64'],
          description: 'File encoding (default: utf-8). Use base64 for binary files.',
        },
      },
      required: ['path'],
    },
  },
};

export const fileWriteTool: Tool = {
  type: 'function',
  function: {
    name: 'write_file',
    description: `Write content to a file. For security, only files in these directories can be written: ${ALLOWED_DIRECTORIES.join(', ')}`,
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to write',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
        append: {
          type: 'boolean',
          description: 'If true, append to file instead of overwriting (default: false)',
        },
      },
      required: ['path', 'content'],
    },
  },
};

export const fileReadHandler: ToolHandler = async (args): Promise<ToolResult> => {
  const filePath = args.path as string;
  const encoding = (args.encoding as 'utf-8' | 'base64') || 'utf-8';

  if (!filePath) {
    return {
      success: false,
      error: 'No file path provided',
    };
  }

  if (!isPathAllowed(filePath)) {
    return {
      success: false,
      error: `Access denied. File must be in one of: ${ALLOWED_DIRECTORIES.join(', ')}`,
    };
  }

  try {
    const resolved = path.resolve(filePath);

    // Check file size
    const stats = await fs.stat(resolved);
    if (stats.size > MAX_READ_SIZE) {
      return {
        success: false,
        error: `File too large (${stats.size} bytes). Maximum: ${MAX_READ_SIZE} bytes`,
      };
    }

    const content = await fs.readFile(resolved, encoding === 'base64' ? 'base64' : 'utf-8');

    return {
      success: true,
      result: `Contents of ${filePath}:\n\n${content}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read file',
    };
  }
};

export const fileWriteHandler: ToolHandler = async (args): Promise<ToolResult> => {
  const filePath = args.path as string;
  const content = args.content as string;
  const append = (args.append as boolean) || false;

  if (!filePath) {
    return {
      success: false,
      error: 'No file path provided',
    };
  }

  if (content === undefined || content === null) {
    return {
      success: false,
      error: 'No content provided',
    };
  }

  if (!isPathAllowed(filePath)) {
    return {
      success: false,
      error: `Access denied. File must be in one of: ${ALLOWED_DIRECTORIES.join(', ')}`,
    };
  }

  if (content.length > MAX_WRITE_SIZE) {
    return {
      success: false,
      error: `Content too large (${content.length} bytes). Maximum: ${MAX_WRITE_SIZE} bytes`,
    };
  }

  try {
    const resolved = path.resolve(filePath);

    // Ensure directory exists
    await fs.mkdir(path.dirname(resolved), { recursive: true });

    if (append) {
      await fs.appendFile(resolved, content, 'utf-8');
    } else {
      await fs.writeFile(resolved, content, 'utf-8');
    }

    return {
      success: true,
      result: `Successfully ${append ? 'appended to' : 'wrote'} file: ${filePath}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to write file',
    };
  }
};
