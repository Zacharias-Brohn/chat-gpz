import { NextRequest } from 'next/server';
import ollama from '@/lib/ollama';

export async function POST(request: NextRequest) {
  try {
    const { model, messages } = await request.json();

    if (!model || !messages) {
      return new Response(JSON.stringify({ error: 'Model and messages are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response = await ollama.chat({
      model,
      messages,
      stream: true,
    });

    // Create a readable stream from the Ollama response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          for await (const chunk of response) {
            const text = chunk.message?.content || '';
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
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
  } catch (error: any) {
    console.error('Chat stream error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to stream response' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
