import { NextRequest } from 'next/server';
import { Message } from 'ollama';
import ollama from '@/lib/ollama';
import { allTools, executeTool, getRegisteredTools } from '@/lib/tools';

// Maximum number of tool call iterations to prevent infinite loops
const MAX_TOOL_ITERATIONS = 10;

/**
 * Parse text-based tool calls from model output
 * Supports formats like:
 * - tool_name[ARGS]{"arg": "value"}
 * - <tool_call>{"name": "tool_name", "arguments": {...}}</tool_call>
 * - {"tool": "tool_name", "arguments": {...}}
 */
function parseTextToolCalls(
  content: string
): Array<{ name: string; arguments: Record<string, unknown> }> {
  const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
  const registeredTools = getRegisteredTools();

  // Pattern 1: tool_name[ARGS]{...}
  const argsPattern = /(\w+)\[ARGS\](\{[\s\S]*?\})/g;
  let match;
  while ((match = argsPattern.exec(content)) !== null) {
    const toolName = match[1];
    try {
      const args = JSON.parse(match[2]);
      if (registeredTools.includes(toolName)) {
        toolCalls.push({ name: toolName, arguments: args });
      }
    } catch {
      // Invalid JSON, skip
    }
  }

  // Pattern 2: <tool_call>{"name": "...", "arguments": {...}}</tool_call>
  const toolCallTagPattern = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  while ((match = toolCallTagPattern.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.name && registeredTools.includes(parsed.name)) {
        toolCalls.push({
          name: parsed.name,
          arguments: parsed.arguments || {},
        });
      }
    } catch {
      // Invalid JSON, skip
    }
  }

  // Pattern 3: Standalone JSON with tool field
  const jsonToolPattern = /\{[\s\S]*?"(?:tool|function)"[\s\S]*?\}/g;
  while ((match = jsonToolPattern.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[0]);
      const toolName = parsed.tool || parsed.function || parsed.name;
      if (toolName && registeredTools.includes(toolName)) {
        toolCalls.push({
          name: toolName,
          arguments: parsed.arguments || parsed.params || parsed.parameters || {},
        });
      }
    } catch {
      // Invalid JSON, skip
    }
  }

  return toolCalls;
}

export async function POST(request: NextRequest) {
  try {
    const { model, messages, enableTools = true } = await request.json();

    if (!model || !messages) {
      return new Response(JSON.stringify({ error: 'Model and messages are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create a readable stream for the response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          // Working copy of messages for tool call iterations
          const workingMessages: Message[] = [...messages];
          let iterations = 0;

          while (iterations < MAX_TOOL_ITERATIONS) {
            iterations++;

            // Call Ollama with tools if enabled
            const response = await ollama.chat({
              model,
              messages: workingMessages,
              tools: enableTools ? allTools : undefined,
              stream: true,
            });

            let fullContent = '';
            let toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

            // Process the streaming response
            for await (const chunk of response) {
              // Collect content
              const text = chunk.message?.content || '';
              if (text) {
                fullContent += text;
                controller.enqueue(encoder.encode(text));
              }

              // Check for native tool calls in the final chunk
              if (chunk.message?.tool_calls) {
                toolCalls = chunk.message.tool_calls.map((tc) => ({
                  name: tc.function.name,
                  arguments: tc.function.arguments as Record<string, unknown>,
                }));
              }
            }

            // If no native tool calls, try to parse text-based tool calls
            if (toolCalls.length === 0 && enableTools) {
              toolCalls = parseTextToolCalls(fullContent);
            }

            // If no tool calls, we're done
            if (toolCalls.length === 0) {
              break;
            }

            // Process tool calls
            controller.enqueue(encoder.encode('\n\n'));

            // Add the assistant's response to messages
            workingMessages.push({
              role: 'assistant',
              content: fullContent,
            });

            // Execute each tool and collect results
            for (const toolCall of toolCalls) {
              // Use structured markers for frontend parsing
              const toolOutput = await executeTool(toolCall.name, toolCall.arguments);
              const toolResult = toolOutput.success
                ? toolOutput.result || ''
                : `Error: ${toolOutput.error}`;

              // Format: <!--TOOL_START:name:args-->result<!--TOOL_END-->
              const toolMarker = `<!--TOOL_START:${toolCall.name}:${JSON.stringify(toolCall.arguments)}-->${toolResult}<!--TOOL_END-->\n\n`;
              controller.enqueue(encoder.encode(toolMarker));

              // Add tool result to messages for next iteration
              workingMessages.push({
                role: 'tool',
                content: toolResult,
              });
            }

            // Continue to let the model respond with the tool results
          }

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error: unknown) {
    console.error('Chat stream error:', error);
    const message = error instanceof Error ? error.message : 'Failed to stream response';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
