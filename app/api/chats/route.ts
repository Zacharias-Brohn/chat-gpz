import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-at-least-32-chars-long'
);

export async function GET(request: NextRequest) {
  const token = request.cookies.get('token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId as string;

    const chats = await prisma.chat.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return NextResponse.json(chats, { status: 200 });
  } catch (error) {
    console.error('Fetch chats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get('token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId as string;
    const { messages, chatId } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    // Determine chat ID or create new
    let currentChatId = chatId;

    // Use the last message in the array, assuming it's the one to be saved
    const messageToSave = messages[messages.length - 1];

    if (!currentChatId) {
      // Create new chat
      const firstMessageContent = messageToSave.content;
      const title =
        firstMessageContent.length > 30
          ? `${firstMessageContent.substring(0, 30)}...`
          : firstMessageContent;

      const newChat = await prisma.chat.create({
        data: {
          userId,
          title,
        },
      });
      currentChatId = newChat.id;
    }

    const { content, role } = messageToSave;

    if (!content || !role) {
      return NextResponse.json({ error: 'Invalid message format' }, { status: 400 });
    }

    const message = await prisma.message.create({
      data: {
        content,
        role,
        chatId: currentChatId,
      },
    });

    // Update chat updated_at
    await prisma.chat.update({
      where: { id: currentChatId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ message, chatId: currentChatId }, { status: 200 });
  } catch (error) {
    console.error('Save chat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
