'use server';

import ollama, { Tool } from 'ollama';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: any[]; // Ollama tool calls
  images?: string[];
}

// --- Tool Definitions ---

const tools: Tool[] = [
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: 'Get the current time',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate',
      description: 'Perform a mathematical calculation',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'The mathematical expression to evaluate (e.g., "2 + 2" or "15 * 7")',
          },
        },
        required: ['expression'],
      },
    },
  },
];

// --- Tool Implementations ---

const availableTools: Record<string, Function> = {
  get_current_time: () => {
    return new Date().toLocaleTimeString();
  },
  calculate: ({ expression }: { expression: string }) => {
    try {
      // Safety: simplistic eval for demo purposes.
      // In production, use a math parser library like mathjs.
      // eslint-disable-next-line no-eval
      return eval(expression).toString();
    } catch {
      return 'Error evaluating expression';
    }
  },
};

export async function chat(model: string, messages: ChatMessage[]) {
  try {
    // 1. Initial Call
    let response;
    try {
      response = await ollama.chat({
        model: model,
        messages: messages,
        tools: tools,
      });
    } catch (e: any) {
      // Fallback: If model doesn't support tools, retry without them
      if (e.message?.includes('does not support tools')) {
        console.warn(`Model ${model} does not support tools. Falling back to standard chat.`);
        response = await ollama.chat({
          model: model,
          messages: messages,
        });
      } else {
        throw e;
      }
    }

    // 2. Loop to handle tool calls (Ollama might chain multiple calls)
    // We limit recursion to avoid infinite loops
    let maxTurns = 5;

    while (response.message.tool_calls && response.message.tool_calls.length > 0 && maxTurns > 0) {
      maxTurns--;

      // Append the assistant's message (which contains the tool calls) to history
      messages.push(response.message as ChatMessage);

      // Execute each tool call
      for (const tool of response.message.tool_calls) {
        const functionName = tool.function.name;
        const functionToCall = availableTools[functionName];

        if (functionToCall) {
          console.log(`🤖 Tool Call: ${functionName}`, tool.function.arguments);
          const functionArgs = tool.function.arguments;
          const functionResponse = functionToCall(functionArgs);

          // Append the tool result to history
          messages.push({
            role: 'tool',
            content: functionResponse,
          });
        }
      }

      // 3. Send the tool results back to the model to get the final answer
      response = await ollama.chat({
        model: model,
        messages: messages,
        tools: tools,
      });
    }

    return {
      success: true,
      message: response.message,
    };
  } catch (error: any) {
    console.error('Chat error:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate response',
    };
  }
}
