'use client';

import { useEffect, useRef, useState } from 'react';
import {
  IconLayoutSidebar,
  IconMessage,
  IconPencil,
  IconPin,
  IconPlus,
  IconRobot,
  IconSend,
  IconSettings,
  IconTrash,
  IconUser,
} from '@tabler/icons-react';
import {
  ActionIcon,
  AppShell,
  Avatar,
  Burger,
  Container,
  Group,
  Menu,
  NavLink,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  TextInputProps,
  Title,
  Tooltip,
  useMantineTheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { getInstalledModels, type OllamaModel } from '@/app/actions/ollama';
import { useThemeContext } from '@/components/DynamicThemeProvider';
import { SettingsModal } from '@/components/Settings/SettingsModal';
import {
  deleteLocalChat,
  deleteScrollPosition,
  getLocalChat,
  getLocalChats,
  getScrollPosition,
  mergeChats,
  saveLocalChat,
  saveScrollPosition,
  setLocalChats,
} from '@/lib/chatStorage';
import { MarkdownMessage } from './MarkdownMessage';
import classes from './ChatLayout.module.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Chat {
  id: string;
  title: string;
  updatedAt: string;
  messages?: Message[];
  pinned?: boolean;
}

type TimeGroup = 'Today' | 'Yesterday' | 'This Week' | 'This Month' | 'Older';

interface GroupedChats {
  pinned: Chat[];
  groups: { label: TimeGroup; chats: Chat[] }[];
}

/**
 * Group chats by time period (Today, Yesterday, This Week, This Month, Older)
 * Pinned chats are separated into their own section
 */
function groupChatsByTime(chats: Chat[]): GroupedChats {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  const pinned: Chat[] = [];
  const todayChats: Chat[] = [];
  const yesterdayChats: Chat[] = [];
  const weekChats: Chat[] = [];
  const monthChats: Chat[] = [];
  const olderChats: Chat[] = [];

  for (const chat of chats) {
    if (chat.pinned) {
      pinned.push(chat);
      continue;
    }

    const chatDate = new Date(chat.updatedAt);

    if (chatDate >= today) {
      todayChats.push(chat);
    } else if (chatDate >= yesterday) {
      yesterdayChats.push(chat);
    } else if (chatDate >= weekAgo) {
      weekChats.push(chat);
    } else if (chatDate >= monthAgo) {
      monthChats.push(chat);
    } else {
      olderChats.push(chat);
    }
  }

  // Build groups array, only including non-empty groups
  const groups: { label: TimeGroup; chats: Chat[] }[] = [];

  if (todayChats.length > 0) {
    groups.push({ label: 'Today', chats: todayChats });
  }
  if (yesterdayChats.length > 0) {
    groups.push({ label: 'Yesterday', chats: yesterdayChats });
  }
  if (weekChats.length > 0) {
    groups.push({ label: 'This Week', chats: weekChats });
  }
  if (monthChats.length > 0) {
    groups.push({ label: 'This Month', chats: monthChats });
  }
  if (olderChats.length > 0) {
    groups.push({ label: 'Older', chats: olderChats });
  }

  return { pinned, groups };
}

export function InputWithButton(props: TextInputProps) {
  const theme = useMantineTheme();

  return (
    <TextInput
      radius="xl"
      size="md"
      placeholder="Type your message..."
      rightSectionWidth={42}
      rightSection={
        <ActionIcon size={32} radius="xl" color={theme.primaryColor} variant="filled">
          <IconSend size={18} stroke={1.5} />
        </ActionIcon>
      }
      {...props}
    />
  );
}

export default function ChatLayout() {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
  const [settingsOpened, { open: openSettings, close: closeSettings }] = useDisclosure(false);
  const { primaryColor, setPrimaryColor } = useThemeContext();
  const theme = useMantineTheme();

  // State
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I am an AI assistant. How can I help you today?',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoadingChats, setIsLoadingChats] = useState(false);

  // Model State
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [_isGenerating, setIsGenerating] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  // Inline editing state
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const justStartedEditing = useRef(false);

  // Scroll state
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);
  const isStreaming = useRef(false);

  // Handle scroll events - save position and track if user scrolled up
  const handleScroll = () => {
    const viewport = scrollViewportRef.current;
    if (!viewport) {
      return;
    }

    // Save scroll position for current chat
    if (activeChatId) {
      saveScrollPosition(activeChatId, viewport.scrollTop);
    }

    // Track if user scrolled up (only when not streaming)
    if (!isStreaming.current) {
      const threshold = 50;
      isUserScrolledUp.current =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight > threshold;
    }
  };

  // Scroll to bottom using CSS scroll-behavior for smooth animation
  const scrollToBottom = () => {
    const viewport = scrollViewportRef.current;
    if (viewport && !isUserScrolledUp.current) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  };

  // Restore scroll position for a chat
  const restoreScrollPosition = (chatId: string) => {
    // Use requestAnimationFrame to wait for DOM to update after messages render
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const viewport = scrollViewportRef.current;
        if (!viewport) {
          return;
        }

        const savedPosition = getScrollPosition(chatId);
        if (savedPosition !== null) {
          // Temporarily disable smooth scrolling for instant restore
          viewport.style.scrollBehavior = 'auto';
          viewport.scrollTop = savedPosition;
          viewport.style.scrollBehavior = '';
        } else {
          // New chat or no saved position - scroll to bottom
          viewport.style.scrollBehavior = 'auto';
          viewport.scrollTop = viewport.scrollHeight;
          viewport.style.scrollBehavior = '';
        }
      });
    });
  };

  // Auto-scroll when messages change (during streaming)
  useEffect(() => {
    if (streamingMessageId) {
      scrollToBottom();
    }
  }, [messages, streamingMessageId]);

  // Track streaming state and scroll to bottom when streaming starts
  useEffect(() => {
    if (streamingMessageId) {
      isStreaming.current = true;
      isUserScrolledUp.current = false;
      scrollToBottom();
    } else {
      isStreaming.current = false;
    }
  }, [streamingMessageId]);

  // Fetch chats and models on load
  useEffect(() => {
    fetchChats();
    fetchModels();
  }, [settingsOpened]);

  const fetchModels = async () => {
    const list = await getInstalledModels();
    setModels(list);
    // Select first model if none selected and list not empty
    if (!selectedModel && list.length > 0) {
      setSelectedModel(list[0].name);
    }
  };

  const fetchChats = async () => {
    // Load from localStorage first for instant display
    const localChats = getLocalChats();
    if (localChats.length > 0) {
      setChats(localChats);
    }

    // Then fetch from database and merge
    setIsLoadingChats(true);
    try {
      const res = await fetch('/api/chats');
      if (res.ok) {
        const remoteChats = await res.json();
        if (Array.isArray(remoteChats)) {
          // Merge local and remote, update both state and localStorage
          const merged = mergeChats(localChats, remoteChats);
          setChats(merged);
          setLocalChats(merged);
        }
      }
    } catch (e) {
      console.error('Failed to fetch chats from server:', e);
      // Keep using local chats if server fails
    } finally {
      setIsLoadingChats(false);
    }
  };

  const handleSelectChat = (chat: Chat) => {
    setActiveChatId(chat.id);

    // Try to load from localStorage first (faster), fall back to passed chat data
    const localChat = getLocalChat(chat.id);
    if (localChat?.messages && localChat.messages.length > 0) {
      setMessages(localChat.messages);
    } else if (chat.messages) {
      setMessages(chat.messages);
    } else {
      setMessages([]);
    }

    if (mobileOpened) {
      toggleMobile();
    }

    // Restore saved scroll position
    restoreScrollPosition(chat.id);
  };

  const handleNewChat = () => {
    setActiveChatId(null);
    setMessages([
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Hello! I am an AI assistant. How can I help you today?',
      },
    ]);
    if (mobileOpened) {
      toggleMobile();
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !selectedModel) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
    };

    // Optimistic update - add user message and empty assistant message for streaming
    const assistantMessageId = (Date.now() + 1).toString();
    const newMessages = [...messages, userMessage];
    setMessages([...newMessages, { id: assistantMessageId, role: 'assistant', content: '' }]);
    setInputValue('');
    setIsGenerating(true);
    setStreamingMessageId(assistantMessageId);

    try {
      // Convert to format expected by API
      const chatHistory = newMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      // Call streaming API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages: chatHistory,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      // Read the stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;

        // Update the assistant message with accumulated content
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMessageId ? { ...m, content: fullContent } : m))
        );
      }

      // Create final response message for saving
      const responseMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: fullContent,
      };

      // Track if this is a new chat (for title generation)
      const isNewChat = !activeChatId;

      // Save to both localStorage and database
      try {
        // Save user message to database
        const userSaveRes = await fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: activeChatId,
            messages: [userMessage],
          }),
        });
        const userSaveData = await userSaveRes.json();
        const savedChatId = userSaveData.chatId;

        // Update activeChatId if this was a new chat
        if (isNewChat && savedChatId) {
          setActiveChatId(savedChatId);
        }

        // Save assistant response to database
        await fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: savedChatId,
            messages: [responseMessage],
          }),
        });

        // Generate a title for new chats using the model
        let chatTitle = `${userMessage.content.slice(0, 30)}...`; // Fallback title

        if (isNewChat && selectedModel) {
          try {
            // Build conversation context (excluding the initial greeting)
            const conversationForTitle = [...newMessages, responseMessage]
              .filter((m) => !(m.role === 'assistant' && m.content.includes('How can I help')))
              .map((m) => ({ role: m.role, content: m.content }));

            const titleRes = await fetch('/api/chat/title', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: selectedModel,
                messages: conversationForTitle,
              }),
            });
            const titleData = await titleRes.json();

            if (titleData.title) {
              chatTitle = titleData.title;

              // Update title in database
              await fetch(`/api/chats/${savedChatId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: chatTitle }),
              });

              // Update title in local state
              setChats((prev) =>
                prev.map((c) => (c.id === savedChatId ? { ...c, title: chatTitle } : c))
              );
            }
          } catch (titleError) {
            // eslint-disable-next-line no-console
            console.error('Failed to generate title:', titleError);
            // Continue with fallback title
          }
        }

        // Save to localStorage
        const finalMessages = [...newMessages, responseMessage];
        saveLocalChat({
          id: savedChatId,
          title: chatTitle,
          updatedAt: new Date().toISOString(),
          messages: finalMessages,
        });

        // Refresh chat list
        fetchChats();
      } catch (saveError) {
        // eslint-disable-next-line no-console
        console.error('Failed to save messages:', saveError);
      }
    } catch (e) {
      console.error('Failed to send message', e);
      // Update assistant message with error
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? { ...m, content: `Error: ${e instanceof Error ? e.message : 'Unknown error'}` }
            : m
        )
      );
    } finally {
      setIsGenerating(false);
      setStreamingMessageId(null);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSendMessage();
    }
  };

  // Chat menu handlers - start inline editing mode
  const handleRenameChat = (chatId: string) => {
    const chat = chats.find((c) => c.id === chatId);
    if (!chat) {
      return;
    }
    // Small delay to let the menu close first before entering edit mode
    setTimeout(() => {
      justStartedEditing.current = true;
      setEditingChatId(chatId);
      setEditingTitle(chat.title);
      // Focus the input after React renders
      setTimeout(() => {
        editInputRef.current?.focus();
        editInputRef.current?.select();
        // Allow blur to work after a short delay
        setTimeout(() => {
          justStartedEditing.current = false;
        }, 100);
      }, 0);
    }, 50);
  };

  // Save the renamed chat title
  const saveRenamedChat = async () => {
    // Skip if we just started editing (prevents immediate blur from closing)
    if (justStartedEditing.current) {
      return;
    }
    if (!editingChatId) {
      return;
    }

    const chat = chats.find((c) => c.id === editingChatId);
    const newTitle = editingTitle.trim();

    // Cancel if empty or unchanged
    if (!newTitle || newTitle === chat?.title) {
      setEditingChatId(null);
      setEditingTitle('');
      return;
    }

    try {
      // Update in database
      await fetch(`/api/chats/${editingChatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });

      // Update local state
      setChats((prev) => prev.map((c) => (c.id === editingChatId ? { ...c, title: newTitle } : c)));

      // Update localStorage
      const localChat = getLocalChat(editingChatId);
      if (localChat) {
        saveLocalChat({ ...localChat, title: newTitle });
      }
    } catch (e) {
      console.error('Failed to rename chat:', e);
    } finally {
      setEditingChatId(null);
      setEditingTitle('');
    }
  };

  // Handle keyboard events in rename input
  const handleRenameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveRenamedChat();
    } else if (event.key === 'Escape') {
      setEditingChatId(null);
      setEditingTitle('');
    }
  };

  const handlePinChat = async (chatId: string) => {
    const chat = chats.find((c) => c.id === chatId);
    if (!chat) {
      return;
    }

    const newPinned = !chat.pinned;

    try {
      // Update in database
      await fetch(`/api/chats/${chatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: newPinned }),
      });

      // Update local state and re-sort (pinned first)
      setChats((prev) => {
        const updated = prev.map((c) => (c.id === chatId ? { ...c, pinned: newPinned } : c));
        return updated.sort((a, b) => {
          if (a.pinned && !b.pinned) {
            return -1;
          }
          if (!a.pinned && b.pinned) {
            return 1;
          }
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
      });

      // Update localStorage
      const localChat = getLocalChat(chatId);
      if (localChat) {
        saveLocalChat({ ...localChat, pinned: newPinned });
      }
    } catch (e) {
      console.error('Failed to pin chat:', e);
    }
  };

  const handleRemoveChat = async (chatId: string) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Are you sure you want to delete this chat?')) {
      return;
    }

    try {
      // Delete from database
      await fetch(`/api/chats/${chatId}`, {
        method: 'DELETE',
      });

      // Remove from local state
      setChats((prev) => prev.filter((c) => c.id !== chatId));

      // Remove from localStorage
      deleteLocalChat(chatId);
      deleteScrollPosition(chatId);

      // If this was the active chat, clear messages
      if (activeChatId === chatId) {
        setActiveChatId(null);
        setMessages([
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Hello! I am an AI assistant. How can I help you today?',
          },
        ]);
      }
    } catch (e) {
      console.error('Failed to delete chat:', e);
    }
  };

  return (
    <>
      <AppShell
        header={{ height: 60 }}
        navbar={{
          width: 300,
          breakpoint: 'sm',
          collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
        }}
        padding="md"
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group>
              <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
              <Tooltip label="Toggle Sidebar">
                <ActionIcon variant="subtle" color="gray" onClick={toggleDesktop} visibleFrom="sm">
                  <IconLayoutSidebar size={20} />
                </ActionIcon>
              </Tooltip>
              <IconRobot size={28} stroke={1.5} color={theme.colors[primaryColor][6]} />
              <Title order={3} mr="md">
                ChatGPZ
              </Title>
              <Select
                placeholder="Select Model"
                data={models.map((m) => ({ value: m.name, label: m.name }))}
                value={selectedModel}
                onChange={setSelectedModel}
                searchable
                size="xs"
                style={{ width: 200 }}
              />
            </Group>
            <ActionIcon variant="subtle" color="gray" onClick={openSettings}>
              <IconSettings size={20} />
            </ActionIcon>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar
          p="md"
          style={{ borderRight: '1px solid var(--mantine-color-default-border)' }}
        >
          <Stack gap="sm" h="100%">
            <Group justify="space-between">
              <Title order={5} c="dimmed">
                Chats
              </Title>
              <Tooltip label="New Chat">
                <ActionIcon variant="light" color={primaryColor} onClick={handleNewChat}>
                  <IconPlus size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <ScrollArea style={{ flex: 1, margin: '0 -10px' }} p="xs">
              {chats.length > 0 ? (
                (() => {
                  const { pinned, groups } = groupChatsByTime(chats);

                  const renderChatItem = (chat: Chat) =>
                    editingChatId === chat.id ? (
                      // Inline editing mode
                      <Group
                        key={chat.id}
                        wrap="nowrap"
                        gap="xs"
                        px="sm"
                        py={6}
                        style={{ minWidth: 0 }}
                      >
                        {chat.pinned ? (
                          <IconPin size={16} stroke={1.5} style={{ minWidth: 16 }} />
                        ) : (
                          <IconMessage size={16} stroke={1.5} style={{ minWidth: 16 }} />
                        )}
                        <TextInput
                          ref={editInputRef}
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.currentTarget.value)}
                          onBlur={saveRenamedChat}
                          onKeyDown={handleRenameKeyDown}
                          size="xs"
                          style={{ flex: 1 }}
                        />
                      </Group>
                    ) : (
                      // Normal display mode with NavLink
                      <div key={chat.id} className={classes.chatListItem}>
                        <NavLink
                          component="button"
                          active={activeChatId === chat.id}
                          color={primaryColor}
                          variant="light"
                          label={chat.title}
                          leftSection={
                            chat.pinned ? (
                              <IconPin size={16} stroke={1.5} />
                            ) : (
                              <IconMessage size={16} stroke={1.5} />
                            )
                          }
                          rightSection={
                            <Menu position="bottom-end" withArrow>
                              <Menu.Target>
                                <ActionIcon
                                  variant="subtle"
                                  color="gray"
                                  size={24}
                                  className={classes.cogwheel}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <IconSettings size={16} />
                                </ActionIcon>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Item
                                  leftSection={<IconPencil size={14} />}
                                  onClick={() => handleRenameChat(chat.id)}
                                >
                                  Rename
                                </Menu.Item>
                                <Menu.Item
                                  leftSection={<IconPin size={14} />}
                                  onClick={() => handlePinChat(chat.id)}
                                >
                                  {chat.pinned ? 'Unpin' : 'Pin'}
                                </Menu.Item>
                                <Menu.Divider />
                                <Menu.Item
                                  color="red"
                                  leftSection={<IconTrash size={14} />}
                                  onClick={() => handleRemoveChat(chat.id)}
                                >
                                  Remove
                                </Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
                          }
                          onClick={() => handleSelectChat(chat)}
                          noWrap
                          styles={{
                            root: {
                              minWidth: 0,
                              borderRadius: 'var(--mantine-radius-sm)',
                              padding: '6px 10px',
                            },
                            label: {
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            },
                          }}
                        />
                      </div>
                    );

                  return (
                    <Stack gap="md">
                      {/* Pinned Section */}
                      {pinned.length > 0 && (
                        <Stack gap={2}>
                          <Text size="xs" fw={600} c="dimmed" tt="uppercase" px="xs">
                            Pinned
                          </Text>
                          {pinned.map(renderChatItem)}
                        </Stack>
                      )}

                      {/* Time-grouped History Sections */}
                      {groups.map((group) => (
                        <Stack key={group.label} gap={2}>
                          <Text size="xs" fw={600} c="dimmed" tt="uppercase" px="xs">
                            {group.label}
                          </Text>
                          {group.chats.map(renderChatItem)}
                        </Stack>
                      ))}
                    </Stack>
                  );
                })()
              ) : (
                <Text size="sm" c="dimmed" ta="center" mt="xl">
                  {isLoadingChats ? 'Loading...' : 'No saved chats'}
                </Text>
              )}
            </ScrollArea>
          </Stack>
        </AppShell.Navbar>

        <AppShell.Main>
          <Container
            size="lg"
            h="calc(100vh - 100px)"
            style={{ display: 'flex', flexDirection: 'column' }}
          >
            <ScrollArea
              flex={1}
              mb="md"
              type="auto"
              offsetScrollbars
              viewportRef={scrollViewportRef}
              onScrollPositionChange={handleScroll}
              classNames={{ viewport: classes.chatScrollViewport }}
            >
              <Stack gap="md" px="md" py="lg">
                {messages.map((message) => (
                  <Group
                    key={message.id}
                    justify={message.role === 'user' ? 'flex-end' : 'flex-start'}
                    align="flex-start"
                    wrap="nowrap"
                    gap="sm"
                  >
                    {message.role === 'assistant' && (
                      <Avatar radius="xl" color={primaryColor} variant="light" size="sm">
                        <IconRobot size={16} />
                      </Avatar>
                    )}

                    {message.role === 'assistant' ? (
                      // Assistant message - no bubble, just text aligned with avatar
                      <div style={{ maxWidth: '85%', paddingTop: 2 }}>
                        <MarkdownMessage
                          content={message.content}
                          isStreaming={message.id === streamingMessageId}
                        />
                      </div>
                    ) : (
                      // User message - colored bubble
                      <Paper
                        py="xs"
                        px="md"
                        radius="lg"
                        bg={`var(--mantine-color-${primaryColor}-light)`}
                        style={{
                          maxWidth: '75%',
                        }}
                      >
                        <Text size="sm" style={{ lineHeight: 1.5 }}>
                          {message.content}
                        </Text>
                      </Paper>
                    )}

                    {message.role === 'user' && (
                      <Avatar radius="xl" color={primaryColor} variant="light" size="sm">
                        <IconUser size={16} />
                      </Avatar>
                    )}
                  </Group>
                ))}
              </Stack>
            </ScrollArea>

            <InputWithButton
              placeholder="Type your message..."
              value={inputValue}
              onChange={(event) => setInputValue(event.currentTarget.value)}
              onKeyDown={handleKeyDown}
              rightSection={
                <ActionIcon
                  onClick={handleSendMessage}
                  variant="filled"
                  color={primaryColor}
                  size={32}
                  radius="xl"
                  disabled={!inputValue.trim()}
                >
                  <IconSend size={18} />
                </ActionIcon>
              }
            />
          </Container>
        </AppShell.Main>
      </AppShell>
      <SettingsModal
        opened={settingsOpened}
        close={closeSettings}
        primaryColor={primaryColor}
        setPrimaryColor={setPrimaryColor}
      />
    </>
  );
}
