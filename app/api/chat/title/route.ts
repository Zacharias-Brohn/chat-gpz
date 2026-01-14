import { NextRequest, NextResponse } from 'next/server';
import ollama from '@/lib/ollama';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Generate a short, descriptive title for a chat based on the conversation
 */
export async function POST(request: NextRequest) {
  try {
    const { model, messages } = await request.json();

    // eslint-disable-next-line no-console
    console.log('[Title API] Request received:', { model, messageCount: messages?.length });

    if (!model || !messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Model and messages array are required' }, { status: 400 });
    }

    // Format the conversation for context
    const conversationContext = messages
      .map((msg: Message) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    // Create a prompt asking for a short title with full context
    const systemPrompt = `You are a helpful assistant that generates very short, descriptive titles for conversations. Based on the conversation below, generate a concise title (3-6 words maximum) that captures the main topic or intent. Reply with ONLY the title text, nothing else - no quotes, no prefixes, no explanation.`;

    const response = await ollama.chat({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Generate a short title for this conversation:\n\n${conversationContext}`,
        },
      ],
      options: {
        temperature: 0.7,
        num_predict: 25, // Limit output length
      },
    });

    // Clean up the response - remove quotes, extra whitespace, etc.
    let title = response.message.content
      .trim()
      .replace(/^["']|["']$/g, '') // Remove surrounding quotes
      .replace(/^Title:\s*/i, '') // Remove "Title:" prefix if present
      .replace(/\n.*/g, '') // Only keep first line
      .trim();

    // Fallback if title is empty or too long
    if (!title || title.length > 50) {
      const firstUserMessage = messages.find((m: Message) => m.role === 'user')?.content || '';
      title = firstUserMessage.slice(0, 30) + (firstUserMessage.length > 30 ? '...' : '');
    }

    // eslint-disable-next-line no-console
    console.log('[Title API] Generated title:', title);

    return NextResponse.json({ title });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Generate title error:', error);

    // Return a fallback - don't fail the request
    return NextResponse.json({
      title: 'New Chat',
      error: error instanceof Error ? error.message : 'Failed to generate title',
    });
  }
}
