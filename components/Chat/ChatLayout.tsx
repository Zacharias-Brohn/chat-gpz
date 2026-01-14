'use client';

import { useEffect, useState } from 'react';
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
  rem,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
  UnstyledButton,
  useMantineTheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useThemeContext } from '@/components/DynamicThemeProvider';
import { SettingsModal } from '@/components/Settings/SettingsModal';

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
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(false);

  // Fetch chats on load
  useEffect(() => {
    fetchChats();
  }, [settingsOpened]); // Refresh when settings close (might have logged in/out)

  const fetchChats = async () => {
    setIsLoadingChats(true);
    try {
      const res = await fetch('/api/chats');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setChats(data);
        } else {
          setChats([]);
        }
      } else {
        setChats([]);
      }
    } catch (e) {
      console.error('Failed to fetch chats', e);
      setChats([]);
    } finally {
      setIsLoadingChats(false);
    }
  };

  const handleSelectChat = (chat: Chat) => {
    setActiveChatId(chat.id);
    if (chat.messages) {
      setMessages(chat.messages);
    } else {
      // In a real app we might fetch full messages here if not included in list
      setMessages([]);
    }
    if (mobileOpened) {
      toggleMobile();
    }
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
    if (!inputValue.trim()) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
    };

    // Optimistic update
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');

    try {
      // Save to backend
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [userMessage],
          chatId: activeChatId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.chatId && data.chatId !== activeChatId) {
          setActiveChatId(data.chatId);
          fetchChats(); // Refresh list to show new chat
        }

        // Simulate AI response
        setTimeout(async () => {
          const responseMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content:
              'I am a simulated AI response. I do not have a backend yet. I just repeat that I am simulated.',
          };

          const updatedMessages = [...newMessages, responseMessage];
          setMessages(updatedMessages);

          // Save AI response to backend
          try {
            await fetch('/api/chats', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: [responseMessage],
                chatId: data.chatId || activeChatId,
              }),
            });
          } catch (e) {
            console.error(e);
          }
        }, 1000);
      }
    } catch (e) {
      console.error('Failed to save message', e);
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
              <Title order={3}>AI Chat</Title>
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
            <ScrollArea flex={1} mb="md" type="auto" offsetScrollbars>
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
                      <Text size="sm" style={{ lineHeight: 1.6 }}>
                        {message.content}
                      </Text>
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

            <Paper
              withBorder
              p="xs"
              radius="xl"
              shadow="sm"
              style={{
                transition: 'border-color 0.2s ease',
                borderColor: isInputFocused ? theme.colors[primaryColor][6] : undefined,
              }}
            >
              <Group gap="xs">
                <TextInput
                  variant="unstyled"
                  placeholder="Type your message..."
                  value={inputValue}
                  onChange={(event) => setInputValue(event.currentTarget.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  style={{ flex: 1, paddingLeft: rem(10) }}
                  size="md"
                />
                <ActionIcon
                  onClick={handleSendMessage}
                  variant="filled"
                  color={primaryColor}
                  size="lg"
                  radius="xl"
                  disabled={!inputValue.trim()}
                >
                  <IconSend size={18} />
                </ActionIcon>
              </Group>
            </Paper>
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
