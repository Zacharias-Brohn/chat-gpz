import { NextRequest } from 'next/server';
import { Message } from 'ollama';
import ollama from '@/lib/ollama';
import { allTools, executeTool } from '@/lib/tools';

// Maximum number of tool call iterations to prevent infinite loops
const MAX_TOOL_ITERATIONS = 10;

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

              // Check for tool calls in the final chunk
              if (chunk.message?.tool_calls) {
                toolCalls = chunk.message.tool_calls.map((tc) => ({
                  name: tc.function.name,
                  arguments: tc.function.arguments as Record<string, unknown>,
                }));
              }
            }

            // If no tool calls, we're done
            if (toolCalls.length === 0) {
              break;
            }

            // Process tool calls
            // Send a marker so frontend knows tool calls are happening
            controller.enqueue(encoder.encode('\n\n---TOOL_CALLS---\n'));

            // Add the assistant's response with tool calls to messages
            workingMessages.push({
              role: 'assistant',
              content: fullContent,
              tool_calls: toolCalls.map((tc) => ({
                function: {
                  name: tc.name,
                  arguments: tc.arguments,
                },
              })),
            });

            // Execute each tool and collect results
            for (const toolCall of toolCalls) {
              controller.enqueue(encoder.encode(`\n**Using tool: ${toolCall.name}**\n`));

              const result = await executeTool(toolCall.name, toolCall.arguments);

              // Send tool result to stream
              if (result.success) {
                controller.enqueue(encoder.encode(`\`\`\`\n${result.result}\n\`\`\`\n`));
              } else {
                controller.enqueue(encoder.encode(`Error: ${result.error}\n`));
              }

              // Add tool result to messages for next iteration
              workingMessages.push({
                role: 'tool',
                content: result.success ? result.result || '' : `Error: ${result.error}`,
              });
            }

            controller.enqueue(encoder.encode('\n---END_TOOL_CALLS---\n\n'));
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
