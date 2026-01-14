/**
 * Calculator tool - evaluates mathematical expressions
 */

import { Tool } from 'ollama';
import { ToolHandler, ToolResult } from './types';

export const calculatorTool: Tool = {
  type: 'function',
  function: {
    name: 'calculator',
    description:
      'Evaluate a mathematical expression. Supports basic arithmetic (+, -, *, /), exponents (^), parentheses, and common math functions (sqrt, sin, cos, tan, log, abs, round, floor, ceil).',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description:
            'The mathematical expression to evaluate, e.g., "2 + 2", "sqrt(16)", "sin(3.14159/2)"',
        },
      },
      required: ['expression'],
    },
  },
};

// Safe math evaluation using Function constructor with limited scope
function safeEvaluate(expression: string): number {
  // Replace common math notation
  let expr = expression
    .replace(/\^/g, '**') // Exponents
    .replace(/sqrt/g, 'Math.sqrt')
    .replace(/sin/g, 'Math.sin')
    .replace(/cos/g, 'Math.cos')
    .replace(/tan/g, 'Math.tan')
    .replace(/log/g, 'Math.log')
    .replace(/abs/g, 'Math.abs')
    .replace(/round/g, 'Math.round')
    .replace(/floor/g, 'Math.floor')
    .replace(/ceil/g, 'Math.ceil')
    .replace(/pi/gi, 'Math.PI')
    .replace(/e(?![a-z])/gi, 'Math.E');

  // Validate: only allow safe characters
  if (!/^[0-9+\-*/().%\s,Math.sqrtincoablgEPI]+$/.test(expr)) {
    throw new Error('Invalid characters in expression');
  }

  // Evaluate using Function constructor (safer than eval)
  const result = new Function(`"use strict"; return (${expr})`)();

  if (typeof result !== 'number' || !isFinite(result)) {
    throw new Error('Expression did not evaluate to a valid number');
  }

  return result;
}

export const calculatorHandler: ToolHandler = async (args): Promise<ToolResult> => {
  const expression = args.expression as string;

  if (!expression) {
    return {
      success: false,
      error: 'No expression provided',
    };
  }

  try {
    const result = safeEvaluate(expression);
    return {
      success: true,
      result: `${expression} = ${result}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to evaluate expression',
    };
  }
};
