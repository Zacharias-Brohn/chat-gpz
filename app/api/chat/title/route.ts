import { NextRequest, NextResponse } from 'next/server';
import ollama from '@/lib/ollama';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Use a fast, non-thinking model for title generation
// DeepSeek R1 outputs <think> tags which complicates parsing
const TITLE_MODEL = 'ministral-3:14b';

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
    const systemPrompt = `Generate a SHORT title (3-6 words) for the conversation below.

IMPORTANT:
- Output ONLY the title text, nothing else
- No quotes, no punctuation, no explanation
- Maximum 6 words
- Be specific and descriptive

Good examples: "Weather in Three Cities", "Python Debugging Help", "Chocolate Cake Recipe", "React Component Tutorial"`;

    const response = await ollama.chat({
      model: TITLE_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Conversation:\n${conversationContext}\n\nTitle:`,
        },
      ],
      options: {
        temperature: 0.3, // Lower temperature for more focused output
        num_predict: 20, // Short response - just the title
      },
    });

    // eslint-disable-next-line no-console
    console.log('[Title API] Raw model response:', response.message.content);

    // Clean up the response - remove quotes, extra whitespace, etc.
    let title = response.message.content
      .trim()
      .replace(/^["']|["']$/g, '') // Remove surrounding quotes
      .replace(/^Title:\s*/i, '') // Remove "Title:" prefix if present
      .replace(/['"]/g, '') // Remove any remaining quotes
      .replace(/\n.*/g, '') // Only keep first line
      .replace(/[.!?]$/, '') // Remove trailing punctuation
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
