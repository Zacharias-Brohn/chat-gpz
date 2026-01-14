import { useEffect, useState } from 'react';
import {
  IconAlertCircle,
  IconDownload,
  IconPalette,
  IconRobot,
  IconTrash,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  ColorSwatch,
  Combobox,
  Divider,
  Group,
  Input,
  InputBase,
  Loader,
  Modal,
  NavLink,
  PasswordInput,
  rem,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
  useCombobox,
  useMantineTheme,
} from '@mantine/core';
import { deleteModel, getInstalledModels, pullModel, type OllamaModel } from '@/app/actions/ollama';

const POPULAR_MODELS = [
  'llama3.2',
  'llama3.1',
  'mistral',
  'gemma2',
  'qwen2.5',
  'phi3.5',
  'neural-chat',
  'starling-lm',
  'codellama',
  'deepseek-coder',
  'llava',
];

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
  const [activeTab, setActiveTab] = useState<'appearance' | 'account' | 'models'>('appearance');

  // Account State
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Models State
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [newModelName, setNewModelName] = useState('');

  // Combobox State
  const [search, setSearch] = useState('');
  const combobox = useCombobox({
    onDropdownClose: () => {
      combobox.resetSelectedOption();
      combobox.focusTarget();
      setSearch('');
    },
    onDropdownOpen: () => {
      combobox.focusSearchInput();
    },
  });

  const [value, setValue] = useState<string | null>(null);

  // Filter installed models based on search
  const options = models
    .filter((item) => item.name.toLowerCase().includes(search.toLowerCase().trim()))
    .map((item) => (
      <Combobox.Option value={item.name} key={item.digest}>
        {item.name}
      </Combobox.Option>
    ));

  // Check login status on mount
  useEffect(() => {
    if (opened) {
      fetchUser();
      if (activeTab === 'models') {
        fetchModels();
      }
    }
  }, [opened, activeTab]);

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

  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      const list = await getInstalledModels();
      setModels(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingModels(false);
    }
  };

  const handlePullModel = async () => {
    if (!newModelName) return;
    setPullingModel(newModelName);
    try {
      const result = await pullModel(newModelName);
      if (result.success) {
        setNewModelName('');
        await fetchModels();
      } else {
        setError(result.message);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPullingModel(null);
    }
  };

  const handleDeleteModel = async (name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await deleteModel(name);
      await fetchModels();
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
            active={activeTab === 'models'}
            label="Models"
            leftSection={<IconRobot size={18} stroke={1.5} />}
            variant="light"
            color={primaryColor}
            onClick={() => setActiveTab('models')}
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

          {activeTab === 'models' && (
            <>
              <Title order={4}>Models</Title>
              <Text size="sm" c="dimmed">
                Manage your local AI models via Ollama.
              </Text>
              <Divider my="sm" />

              <Group align="flex-end">
                <Combobox
                  store={combobox}
                  withinPortal={false}
                  onOptionSubmit={(val) => {
                    setNewModelName(val);
                    combobox.closeDropdown();
                    // Optional: trigger pull immediately or let user click button?
                    // User code sample sets value. I'll set newModelName.
                  }}
                >
                  <Combobox.Target>
                    <InputBase
                      component="button"
                      type="button"
                      pointer
                      rightSection={<Combobox.Chevron />}
                      onClick={() => combobox.toggleDropdown()}
                      rightSectionPointerEvents="none"
                      label="Download Model"
                      description="Select an installed model to update, or type a new model name (e.g. llama3)"
                      style={{ flex: 1 }}
                    >
                      {newModelName || (
                        <Input.Placeholder>Pick or type model name</Input.Placeholder>
                      )}
                    </InputBase>
                  </Combobox.Target>

                  <Combobox.Dropdown>
                    <Combobox.Search
                      value={search}
                      onChange={(event) => {
                        setSearch(event.currentTarget.value);
                        setNewModelName(event.currentTarget.value); // Allow typing new names
                      }}
                      placeholder="Search installed models or type new one"
                    />
                    <Combobox.Options>
                      {options.length > 0 ? (
                        options
                      ) : (
                        <Combobox.Empty>No matching installed models</Combobox.Empty>
                      )}
                    </Combobox.Options>
                  </Combobox.Dropdown>
                </Combobox>

                <Button
                  onClick={handlePullModel}
                  loading={!!pullingModel}
                  leftSection={<IconDownload size={16} />}
                  color={primaryColor}
                >
                  Pull
                </Button>
              </Group>

              {pullingModel && (
                <Alert icon={<Loader size={16} />} title="Downloading..." color="blue" mt="md">
                  Pulling {pullingModel}. This may take a while depending on your connection.
                </Alert>
              )}

              <Text size="sm" fw={500} mt="xl" mb="xs">
                Installed Models
              </Text>

              {loadingModels ? (
                <Group justify="center" py="xl">
                  <Loader size="sm" />
                </Group>
              ) : models.length === 0 ? (
                <Text c="dimmed" size="sm" ta="center" py="xl">
                  No models found. Try pulling one!
                </Text>
              ) : (
                <ScrollArea h={300} offsetScrollbars>
                  <Stack gap="xs">
                    {models.map((model) => (
                      <Card key={model.digest} withBorder padding="sm" radius="md">
                        <Group justify="space-between">
                          <div>
                            <Text fw={500} size="sm">
                              {model.name}
                            </Text>
                            <Group gap="xs">
                              <Badge size="xs" variant="light" color="gray">
                                {(model.size / 1024 / 1024 / 1024).toFixed(2)} GB
                              </Badge>
                              <Badge size="xs" variant="light" color="blue">
                                {model.details.parameter_size}
                              </Badge>
                              <Badge size="xs" variant="light" color="orange">
                                {model.details.quantization_level}
                              </Badge>
                            </Group>
                          </div>
                          <ActionIcon
                            color="red"
                            variant="subtle"
                            onClick={() => handleDeleteModel(model.name)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      </Card>
                    ))}
                  </Stack>
                </ScrollArea>
              )}
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
