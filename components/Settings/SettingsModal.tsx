import { useEffect, useState } from 'react';
import { IconAlertCircle, IconPalette, IconUser, IconX } from '@tabler/icons-react';
import {
  ActionIcon,
  Alert,
  Button,
  ColorSwatch,
  Divider,
  Group,
  Modal,
  NavLink,
  PasswordInput,
  rem,
  Stack,
  Text,
  TextInput,
  Title,
  useMantineTheme,
} from '@mantine/core';

interface User {
  id: string;
  username: string;
}

interface SettingsModalProps {
  opened: boolean;
  close: () => void;
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
}

export function SettingsModal({
  opened,
  close,
  primaryColor,
  setPrimaryColor,
}: SettingsModalProps) {
  const theme = useMantineTheme();
  const [activeTab, setActiveTab] = useState<'appearance' | 'account'>('appearance');

  // Account State
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Check login status on mount
  useEffect(() => {
    if (opened) {
      fetchUser();
    }
  }, [opened]);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAuth = async () => {
    setError('');
    setLoading(true);
    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      // Refresh user state
      await fetchUser();
      setUsername('');
      setPassword('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  const colors = Object.keys(theme.colors).filter(
    (color) => color !== 'dark' && color !== 'gray' && color !== 'white' && color !== 'black'
  );

  return (
    <Modal
      opened={opened}
      onClose={close}
      withCloseButton={false}
      size="lg"
      padding={0}
      radius="xl"
    >
      <Group align="stretch" gap={0} style={{ minHeight: 400, overflow: 'hidden' }}>
        {/* Left Sidebar */}
        <Stack
          gap="xs"
          w={220}
          p="sm"
          bg="var(--mantine-color-default-hover)"
          style={{
            borderRight: '1px solid var(--mantine-color-default-border)',
          }}
        >
          <NavLink
            active={activeTab === 'appearance'}
            label="Appearance"
            leftSection={<IconPalette size={18} stroke={1.5} />}
            variant="light"
            color={primaryColor}
            onClick={() => setActiveTab('appearance')}
            style={{ borderRadius: 'var(--mantine-radius-lg)' }}
          />
          <NavLink
            active={activeTab === 'account'}
            label="Account"
            leftSection={<IconUser size={18} stroke={1.5} />}
            variant="light"
            color={primaryColor}
            onClick={() => setActiveTab('account')}
            style={{ borderRadius: 'var(--mantine-radius-lg)' }}
          />
        </Stack>

        {/* Right Content */}
        <Stack p="xl" style={{ flex: 1, position: 'relative' }}>
          <ActionIcon
            onClick={close}
            variant="subtle"
            color="gray"
            size="sm"
            style={{ position: 'absolute', top: rem(15), right: rem(15), zIndex: 1 }}
          >
            <IconX size={20} />
          </ActionIcon>

          {activeTab === 'appearance' && (
            <>
              <Title order={4}>Appearance</Title>
              <Text size="sm" c="dimmed">
                Customize the look and feel of the application.
              </Text>

              <Divider my="sm" />

              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Accent Color
                </Text>
                <Group gap="xs">
                  {colors.map((color) => (
                    <ColorSwatch
                      key={color}
                      component="button"
                      color={theme.colors[color][6]}
                      onClick={() => setPrimaryColor(color)}
                      style={{ color: '#fff', cursor: 'pointer' }}
                      withShadow
                    >
                      {primaryColor === color && <IconPalette size={12} />}
                    </ColorSwatch>
                  ))}
                </Group>
              </Stack>
            </>
          )}

          {activeTab === 'account' && (
            <>
              <Title order={4}>Account</Title>
              <Text size="sm" c="dimmed">
                Manage your account and chat history.
              </Text>
              <Divider my="sm" />

              {user ? (
                <Stack>
                  <Text>
                    Logged in as <b>{user.username}</b>
                  </Text>
                  <Button color="red" variant="light" onClick={handleLogout}>
                    Log out
                  </Button>
                </Stack>
              ) : (
                <Stack>
                  {error && (
                    <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
                      {error}
                    </Alert>
                  )}
                  <TextInput
                    label="Username"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                  <PasswordInput
                    label="Password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Group justify="space-between" mt="md">
                    <Text
                      size="xs"
                      style={{ cursor: 'pointer' }}
                      c="blue"
                      onClick={() => setIsLoginMode(!isLoginMode)}
                    >
                      {isLoginMode ? 'Need an account? Register' : 'Have an account? Login'}
                    </Text>
                    <Button onClick={handleAuth} loading={loading} color={primaryColor}>
                      {isLoginMode ? 'Login' : 'Register'}
                    </Button>
                  </Group>
                </Stack>
              )}
            </>
          )}
        </Stack>
      </Group>
    </Modal>
  );
}
