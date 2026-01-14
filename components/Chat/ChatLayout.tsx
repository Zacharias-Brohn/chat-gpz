'use client';

import { useEffect, useRef, useState } from 'react';
import {
  IconLayoutSidebar,
  IconMessage,
  IconPlus,
  IconRobot,
  IconSend,
  IconSettings,
  IconUser,
} from '@tabler/icons-react';
import {
  ActionIcon,
  AppShell,
  Avatar,
  Burger,
  Container,
  Group,
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
  getLocalChat,
  getLocalChats,
  mergeChats,
  saveLocalChat,
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

  // Scroll state
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);
  const isStreaming = useRef(false);

  // Handle scroll events to track if user scrolled up (only when not streaming)
  const handleScroll = () => {
    if (isStreaming.current) {
      return; // Ignore scroll position checks during streaming
    }
    const viewport = scrollViewportRef.current;
    if (!viewport) {
      return;
    }
    const threshold = 50;
    isUserScrolledUp.current =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight > threshold;
  };

  // Scroll to bottom using CSS scroll-behavior for smooth animation
  const scrollToBottom = () => {
    const viewport = scrollViewportRef.current;
    if (viewport && !isUserScrolledUp.current) {
      viewport.scrollTop = viewport.scrollHeight;
    }
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
    // Scroll to bottom after messages load
    setTimeout(() => {
      const viewport = scrollViewportRef.current;
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }, 0);
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
                    <UnstyledButton
                      key={chat.id}
                      onClick={() => handleSelectChat(chat)}
                      p="sm"
                      style={{
                        borderRadius: 'var(--mantine-radius-md)',
                        backgroundColor:
                          activeChatId === chat.id
                            ? 'var(--mantine-color-default-hover)'
                            : 'transparent',
                        transition: 'background-color 0.2s',
                      }}
                    >
                      <Group wrap="nowrap">
                        <IconMessage size={18} color="gray" style={{ minWidth: 18 }} />
                        <Text size="sm" truncate>
                          {chat.title}
                        </Text>
                      </Group>
                    </UnstyledButton>
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
