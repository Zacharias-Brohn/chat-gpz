/**
 * Local storage utilities for chat persistence
 * Provides fast local access while syncing with the database
 */

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Chat {
  id: string;
  title: string;
  updatedAt: string;
  messages: Message[];
}

const CHATS_STORAGE_KEY = 'chat-gpz-chats';

/**
 * Get all chats from localStorage
 */
export function getLocalChats(): Chat[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const stored = localStorage.getItem(CHATS_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored) as Chat[];
  } catch (e) {
    console.error('Failed to parse local chats:', e);
    return [];
  }
}

/**
 * Save all chats to localStorage
 */
export function setLocalChats(chats: Chat[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chats));
  } catch (e) {
    console.error('Failed to save local chats:', e);
  }
}

/**
 * Get a single chat by ID from localStorage
 */
export function getLocalChat(chatId: string): Chat | null {
  const chats = getLocalChats();
  return chats.find((c) => c.id === chatId) || null;
}

/**
 * Save or update a single chat in localStorage
 */
export function saveLocalChat(chat: Chat): void {
  const chats = getLocalChats();
  const existingIndex = chats.findIndex((c) => c.id === chat.id);

  if (existingIndex >= 0) {
    chats[existingIndex] = chat;
  } else {
    chats.unshift(chat); // Add to beginning (most recent)
  }

  setLocalChats(chats);
}

/**
 * Add a message to an existing chat in localStorage
 */
export function addMessageToLocalChat(chatId: string, message: Message): void {
  const chats = getLocalChats();
  const chat = chats.find((c) => c.id === chatId);

  if (chat) {
    chat.messages.push(message);
    chat.updatedAt = new Date().toISOString();
    setLocalChats(chats);
  }
}

/**
 * Delete a chat from localStorage
 */
export function deleteLocalChat(chatId: string): void {
  const chats = getLocalChats();
  const filtered = chats.filter((c) => c.id !== chatId);
  setLocalChats(filtered);
}

/**
 * Merge remote chats with local chats
 * Remote chats take precedence for conflicts (based on updatedAt)
 */
export function mergeChats(localChats: Chat[], remoteChats: Chat[]): Chat[] {
  const chatMap = new Map<string, Chat>();

  // Add local chats first
  for (const chat of localChats) {
    chatMap.set(chat.id, chat);
  }

  // Override with remote chats (they're the source of truth)
  for (const chat of remoteChats) {
    const local = chatMap.get(chat.id);
    if (!local || new Date(chat.updatedAt) >= new Date(local.updatedAt)) {
      chatMap.set(chat.id, chat);
    }
  }

  // Sort by updatedAt descending
  return Array.from(chatMap.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Clear all local chats (useful for logout)
 */
export function clearLocalChats(): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(CHATS_STORAGE_KEY);
}
