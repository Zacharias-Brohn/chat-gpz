'use client';

import { useEffect, useRef, useState } from 'react';
import {
  IconDotsVertical,
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
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  TextInputProps,
  Title,
  Tooltip,
  UnstyledButton,
  useMantineTheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { getInstalledModels, type OllamaModel } from '@/app/actions/ollama';
import { useThemeContext } from '@/components/DynamicThemeProvider';
import { SettingsModal } from '@/components/Settings/SettingsModal';
import {
  addMessageToLocalChat,
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
        const chatTitle = userSaveData.title || userMessage.content.slice(0, 50);

        // Update activeChatId if this was a new chat
        if (!activeChatId && savedChatId) {
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
    setEditingChatId(chatId);
    setEditingTitle(chat.title);
    // Focus the input after React renders
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  // Save the renamed chat title
  const saveRenamedChat = async () => {
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
                History
              </Title>
              <Tooltip label="New Chat">
                <ActionIcon variant="light" color={primaryColor} onClick={handleNewChat}>
                  <IconPlus size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <ScrollArea style={{ flex: 1, margin: '0 -10px' }} p="xs">
              <Stack gap="xs">
                {chats.length > 0 ? (
                  chats.map((chat) => (
                    <Group
                      key={chat.id}
                      gap={0}
                      wrap="nowrap"
                      style={{
                        borderRadius: 'var(--mantine-radius-md)',
                        backgroundColor:
                          activeChatId === chat.id
                            ? 'var(--mantine-color-default-hover)'
                            : 'transparent',
                        transition: 'background-color 0.2s',
                      }}
                    >
                      {editingChatId === chat.id ? (
                        // Inline editing mode
                        <Group wrap="nowrap" gap="xs" p="sm" style={{ flex: 1, minWidth: 0 }}>
                          {chat.pinned ? (
                            <IconPin size={18} color="gray" style={{ minWidth: 18 }} />
                          ) : (
                            <IconMessage size={18} color="gray" style={{ minWidth: 18 }} />
                          )}
                          <TextInput
                            ref={editInputRef}
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.currentTarget.value)}
                            onBlur={saveRenamedChat}
                            onKeyDown={handleRenameKeyDown}
                            size="xs"
                            variant="unstyled"
                            styles={{
                              input: {
                                padding: 0,
                                height: 'auto',
                                minHeight: 'unset',
                                fontSize: 'var(--mantine-font-size-sm)',
                              },
                            }}
                            style={{ flex: 1 }}
                          />
                        </Group>
                      ) : (
                        // Normal display mode
                        <UnstyledButton
                          onClick={() => handleSelectChat(chat)}
                          p="sm"
                          style={{ flex: 1, minWidth: 0 }}
                        >
                          <Group wrap="nowrap" gap="xs">
                            {chat.pinned ? (
                              <IconPin size={18} color="gray" style={{ minWidth: 18 }} />
                            ) : (
                              <IconMessage size={18} color="gray" style={{ minWidth: 18 }} />
                            )}
                            <Text size="sm" truncate style={{ flex: 1 }}>
                              {chat.title}
                            </Text>
                          </Group>
                        </UnstyledButton>
                      )}

                      <Menu position="bottom-end" withArrow>
                        <Menu.Target>
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            mr="xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <IconDotsVertical size={16} />
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
                    </Group>
                  ))
                ) : (
                  <Text size="sm" c="dimmed" ta="center" mt="xl">
                    {isLoadingChats ? 'Loading...' : 'No saved chats'}
                  </Text>
                )}
              </Stack>
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
              <Stack gap="xl" px="md" py="lg">
                {messages.map((message) => (
                  <Group
                    key={message.id}
                    justify={message.role === 'user' ? 'flex-end' : 'flex-start'}
                    align="flex-start"
                    wrap="nowrap"
                  >
                    {message.role === 'assistant' && (
                      <Avatar radius="xl" color={primaryColor} variant="light">
                        <IconRobot size={20} />
                      </Avatar>
                    )}

                    <Paper
                      p="md"
                      radius="lg"
                      bg={
                        message.role === 'user'
                          ? 'var(--mantine-color-default-hover)'
                          : 'transparent'
                      }
                      style={{
                        maxWidth: '80%',
                        borderTopLeftRadius: message.role === 'assistant' ? 0 : undefined,
                        borderTopRightRadius: message.role === 'user' ? 0 : undefined,
                      }}
                    >
                      {message.role === 'assistant' ? (
                        <MarkdownMessage
                          content={message.content}
                          isStreaming={message.id === streamingMessageId}
                        />
                      ) : (
                        <Text size="sm" style={{ lineHeight: 1.6 }}>
                          {message.content}
                        </Text>
                      )}
                    </Paper>

                    {message.role === 'user' && (
                      <Avatar radius="xl" color="gray" variant="light">
                        <IconUser size={20} />
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
