import { NextRequest } from 'next/server';
import { Message } from 'ollama';
import ollama from '@/lib/ollama';
import { allTools, executeTool, getRegisteredTools } from '@/lib/tools';

// Maximum number of tool call iterations to prevent infinite loops
const MAX_TOOL_ITERATIONS = 5;

// Maximum tokens for model responses (effectively unlimited for long reasoning)
const MAX_RESPONSE_TOKENS = 32768;

// System prompt for tool-enabled conversations
const TOOL_SYSTEM_PROMPT = `You are a helpful AI assistant with access to various tools.

## CRITICAL Tool Usage Rules

1. **ONE attempt per tool**: If a tool returns a result (even partial), USE that result. Do NOT retry the same tool with different parameters.

2. **Accept first valid result**: When you get weather, search results, or any data - use it immediately in your response. Don't try to "improve" it.

3. **Handle errors gracefully**: If a tool fails, tell the user. Do NOT retry with variations.

4. **Give a final answer**: After using tools, you MUST provide a helpful summary to the user. Never end with just tool calls.

5. **Be specific with locations**: For vague locations like "Arizona", pick the most likely city (e.g., Phoenix) and use it once.

Example of CORRECT behavior:
- User: "Weather in Arizona"
- You: Call get_weather with "Phoenix, Arizona" ONCE
- Tool returns result
- You: Summarize the weather for the user

Example of WRONG behavior:
- Calling the same tool multiple times with slight variations
- Not providing a final response after getting tool results`;

// Message to inject when max iterations reached to force a response
const FORCE_RESPONSE_MESSAGE = `You have made several tool calls. Now you MUST provide a final response to the user based on the information you have gathered. Do NOT make any more tool calls. Summarize what you learned and answer the user's question.`;

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
          // Inject system prompt for tool guidance if tools are enabled
          const workingMessages: Message[] = enableTools
            ? [{ role: 'system', content: TOOL_SYSTEM_PROMPT }, ...messages]
            : [...messages];
          let iterations = 0;

          while (iterations < MAX_TOOL_ITERATIONS) {
            iterations++;

            // If we're on the last allowed iteration, force the model to respond without tools
            const isLastIteration = iterations === MAX_TOOL_ITERATIONS;
            if (isLastIteration) {
              // Add a message forcing the model to give a final response
              workingMessages.push({
                role: 'user',
                content: FORCE_RESPONSE_MESSAGE,
              });
            }

            // Call Ollama with tools if enabled (but disable on last iteration)
            // Enable thinking mode for models that support it (like deepseek-r1)
            const response = await ollama.chat({
              model,
              messages: workingMessages,
              tools: enableTools && !isLastIteration ? allTools : undefined,
              stream: true,
              think: true, // Enable thinking mode - model will separate thinking from response
              options: {
                num_predict: MAX_RESPONSE_TOKENS,
              },
            });

            let fullContent = '';
            let fullThinking = '';
            let thinkingSent = false;
            let toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

            // Process the streaming response
            for await (const chunk of response) {
              // Check for thinking content (separate from main content)
              const thinking = chunk.message?.thinking || '';
              if (thinking) {
                fullThinking += thinking;
                // Don't stream thinking - we'll wrap it at the end
              }

              // Collect main content
              const text = chunk.message?.content || '';
              if (text) {
                // If we have accumulated thinking and haven't sent it yet, send it first
                if (fullThinking && !thinkingSent) {
                  const thinkingMarker = `<think>${fullThinking}</think>\n\n`;
                  controller.enqueue(encoder.encode(thinkingMarker));
                  thinkingSent = true;
                }
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

            // If we have thinking that wasn't sent yet (no content followed it), send it now
            if (fullThinking && !thinkingSent) {
              const thinkingMarker = `<think>${fullThinking}</think>\n\n`;
              controller.enqueue(encoder.encode(thinkingMarker));
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
