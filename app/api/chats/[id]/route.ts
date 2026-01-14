import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-at-least-32-chars-long'
);

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/chats/[id] - Update chat (rename, pin)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const token = request.cookies.get('token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId as string;
    const { id: chatId } = await params;
    const body = await request.json();

    // Verify chat belongs to user
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Build update object
    const updateData: { title?: string; pinned?: boolean } = {};
    if (typeof body.title === 'string') {
      updateData.title = body.title;
    }
    if (typeof body.pinned === 'boolean') {
      updateData.pinned = body.pinned;
    }

    const updatedChat = await prisma.chat.update({
      where: { id: chatId },
      data: updateData,
    });

    return NextResponse.json(updatedChat, { status: 200 });
  } catch (error) {
    console.error('Update chat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/chats/[id] - Delete chat
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const token = request.cookies.get('token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId as string;
    const { id: chatId } = await params;

    // Verify chat belongs to user
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Delete messages first (cascade), then chat
    await prisma.message.deleteMany({
      where: { chatId },
    });

    await prisma.chat.delete({
      where: { id: chatId },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Delete chat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
