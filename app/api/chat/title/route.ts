import { NextRequest, NextResponse } from 'next/server';
import ollama from '@/lib/ollama';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Use a fast, consistent model for title generation
const TITLE_MODEL = 'deepseek-r1:8b';

/**
 * Generate a short, descriptive title for a chat based on the conversation
 */
export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    // eslint-disable-next-line no-console
    console.log('[Title API] Request received:', {
      model: TITLE_MODEL,
      messageCount: messages?.length,
    });

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    // Format the conversation for context (truncate long messages)
    const conversationContext = messages
      .map((msg: Message) => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        const content = msg.content.length > 300 ? `${msg.content.slice(0, 300)}...` : msg.content;
        return `${role}: ${content}`;
      })
      .join('\n\n');

    // Create a prompt asking for a short title with full context
    const systemPrompt = `Your task is to generate a SHORT title (3-6 words) for a conversation.

Rules:
- Output ONLY the title, nothing else
- No quotes, no "Title:" prefix, no explanation
- Maximum 6 words
- Be descriptive but concise
- Examples of good titles:
  - "Weather Comparison Three Cities"
  - "Python Debugging Help"
  - "Recipe for Chocolate Cake"
  - "React Component Tutorial"`;

    const response = await ollama.chat({
      model: TITLE_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Conversation:\n\n${conversationContext}\n\nGenerate a 3-6 word title:`,
        },
      ],
      options: {
        temperature: 0.3, // Lower temperature for more focused output
        num_predict: 50, // Allow more tokens for thinking models
      },
    });

    // eslint-disable-next-line no-console
    console.log('[Title API] Raw model response:', response.message.content);

    // Clean up the response - remove quotes, extra whitespace, thinking, etc.
    let title = response.message.content
      .trim()
      .replace(/<think>[\s\S]*?<\/think>/g, '') // Remove thinking tags
      .replace(/^["']|["']$/g, '') // Remove surrounding quotes
      .replace(/^Title:\s*/i, '') // Remove "Title:" prefix if present
      .replace(/^["']|["']$/g, '') // Remove quotes again after prefix removal
      .replace(/\n.*/g, '') // Only keep first line
      .trim();

    // If still too long, take first 6 words
    const words = title.split(/\s+/);
    if (words.length > 6) {
      title = words.slice(0, 6).join(' ');
    }

    // Fallback if title is empty or suspiciously long (model didn't follow instructions)
    if (!title || title.length > 60) {
      const firstUserMessage = messages.find((m: Message) => m.role === 'user')?.content || '';
      // Extract key words instead of just truncating
      const keyWords = firstUserMessage
        .replace(/[?!.,]/g, '')
        .split(/\s+/)
        .slice(0, 5)
        .join(' ');
      title = keyWords || 'New Chat';
    }

    // eslint-disable-next-line no-console
    console.log('[Title API] Final title:', title);

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
