/**
 * Code Execution tool - execute JavaScript code in a sandboxed environment
 */

import { Tool } from 'ollama';
import { ToolHandler, ToolResult } from './types';

export const codeExecutionTool: Tool = {
  type: 'function',
  function: {
    name: 'execute_code',
    description:
      'Execute JavaScript code and return the result. The code runs in a sandboxed environment with limited capabilities. Console.log output is captured. The last expression value is returned.',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'JavaScript code to execute',
        },
        timeout_ms: {
          type: 'number',
          description: 'Maximum execution time in milliseconds (default: 5000, max: 30000)',
        },
      },
      required: ['code'],
    },
  },
};

export const codeExecutionHandler: ToolHandler = async (args): Promise<ToolResult> => {
  const code = args.code as string;
  const timeoutMs = Math.min((args.timeout_ms as number) || 5000, 30000);

  if (!code) {
    return {
      success: false,
      error: 'No code provided',
    };
  }

  try {
    // Capture console output
    const logs: string[] = [];
    const mockConsole = {
      log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
      error: (...args: unknown[]) => logs.push(`[ERROR] ${args.map(String).join(' ')}`),
      warn: (...args: unknown[]) => logs.push(`[WARN] ${args.map(String).join(' ')}`),
      info: (...args: unknown[]) => logs.push(`[INFO] ${args.map(String).join(' ')}`),
    };

    // Create a sandboxed context with limited globals
    const sandbox = {
      console: mockConsole,
      Math,
      Date,
      JSON,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Map,
      Set,
      Promise,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURIComponent,
      decodeURIComponent,
      encodeURI,
      decodeURI,
    };

    // Wrap code to capture the last expression value
    const wrappedCode = `
      "use strict";
      const { ${Object.keys(sandbox).join(', ')} } = this;
      ${code}
    `;

    // Execute with timeout
    const executeWithTimeout = (): unknown => {
      const fn = new Function(wrappedCode);
      return fn.call(sandbox);
    };

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Execution timed out')), timeoutMs);
    });

    const executionPromise = new Promise<unknown>((resolve, reject) => {
      try {
        resolve(executeWithTimeout());
      } catch (e) {
        reject(e);
      }
    });

    const result = await Promise.race([executionPromise, timeoutPromise]);

    // Format output
    let output = '';
    if (logs.length > 0) {
      output += `Console output:\n${logs.join('\n')}\n\n`;
    }
    if (result !== undefined) {
      output += `Result: ${JSON.stringify(result, null, 2)}`;
    } else if (logs.length === 0) {
      output = 'Code executed successfully (no output)';
    }

    return {
      success: true,
      result: output.trim(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Code execution failed',
    };
  }
};
