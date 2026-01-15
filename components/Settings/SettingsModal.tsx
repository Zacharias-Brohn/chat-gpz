import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconAlertCircle,
  IconDownload,
  IconPalette,
  IconRefresh,
  IconRobot,
  IconSearch,
  IconTrash,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import {
  Accordion,
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  ColorSwatch,
  Divider,
  Group,
  Loader,
  Modal,
  NavLink,
  Pagination,
  PasswordInput,
  rem,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
  useMantineTheme,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { deleteModel, getInstalledModels, pullModel, type OllamaModel } from '@/app/actions/ollama';

// Type for the scraped models JSON
interface OllamaModelsData {
  generatedAt: string;
  modelCount: number;
  models: Record<string, string[]>;
}

interface User {
  id: string;
  username: string;
  accentColor?: string;
}

interface SettingsModalProps {
  opened: boolean;
  close: () => void;
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
}

// Session-level cache for available models (survives modal close/open)
let availableModelsCache: OllamaModelsData | null = null;
let installedModelsCache: OllamaModel[] | null = null;

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
  const [installedModels, setInstalledModels] = useState<OllamaModel[]>(installedModelsCache || []);
  const [availableModels, setAvailableModels] = useState<OllamaModelsData | null>(
    availableModelsCache
  );
  const [loadingInstalled, setLoadingInstalled] = useState(false);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [pullError, setPullError] = useState('');

  // Search state for available models (with debounce for performance)
  const [modelSearch, setModelSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(modelSearch, 200);

  // Pagination state
  const MODELS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);

  // Track if we've fetched this session
  const hasFetchedInstalled = useRef(false);
  const hasFetchedAvailable = useRef(false);

  // Get list of model names sorted alphabetically
  const modelNames = useMemo(
    () => (availableModels ? Object.keys(availableModels.models).sort() : []),
    [availableModels]
  );

  // Filter models based on debounced search
  const filteredModels = useMemo(
    () =>
      modelNames.filter((name) =>
        name.toLowerCase().includes(debouncedSearch.toLowerCase().trim())
      ),
    [modelNames, debouncedSearch]
  );

  // Paginated models - only render what's visible
  const totalPages = Math.ceil(filteredModels.length / MODELS_PER_PAGE);
  const paginatedModels = useMemo(() => {
    const start = (currentPage - 1) * MODELS_PER_PAGE;
    return filteredModels.slice(start, start + MODELS_PER_PAGE);
  }, [filteredModels, currentPage]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  // Fetch available models from the static JSON
  const fetchAvailableModels = useCallback(async (force = false) => {
    if (!force && availableModelsCache) {
      setAvailableModels(availableModelsCache);
      return;
    }

    setLoadingAvailable(true);
    try {
      const response = await fetch('/ollama-models.json');
      if (response.ok) {
        const data: OllamaModelsData = await response.json();
        availableModelsCache = data;
        setAvailableModels(data);
      }
    } catch (e) {
      console.error('Failed to fetch available models:', e);
    } finally {
      setLoadingAvailable(false);
    }
  }, []);

  // Fetch installed models from Ollama
  const fetchInstalledModels = useCallback(async (force = false) => {
    if (!force && installedModelsCache) {
      setInstalledModels(installedModelsCache);
      return;
    }

    setLoadingInstalled(true);
    try {
      const list = await getInstalledModels();
      installedModelsCache = list;
      setInstalledModels(list);
    } catch (e) {
      console.error('Failed to fetch installed models:', e);
    } finally {
      setLoadingInstalled(false);
    }
  }, []);

  // Check login status on mount
  useEffect(() => {
    if (opened) {
      fetchUser();
      if (activeTab === 'models') {
        if (!hasFetchedInstalled.current) {
          fetchInstalledModels();
          hasFetchedInstalled.current = true;
        }
        if (!hasFetchedAvailable.current) {
          fetchAvailableModels();
          hasFetchedAvailable.current = true;
        }
      }
    }
  }, [opened, activeTab, fetchInstalledModels, fetchAvailableModels]);

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

  const handlePullModel = async (modelName: string, tag: string) => {
    const fullModelName = `${modelName}:${tag}`;

    setPullingModel(fullModelName);
    setPullError('');

    try {
      const result = await pullModel(fullModelName);
      if (result.success) {
        // Force refresh installed models
        await fetchInstalledModels(true);
      } else {
        setPullError(result.message);
      }
    } catch (e) {
      console.error(e);
      setPullError('An error occurred while pulling the model');
    } finally {
      setPullingModel(null);
    }
  };

  const handleDeleteModel = async (name: string) => {
    // eslint-disable-next-line no-alert
    if (!confirm(`Are you sure you want to delete ${name}?`)) {
      return;
    }
    try {
      await deleteModel(name);
      // Force refresh installed models
      await fetchInstalledModels(true);
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  const handleAccentColorChange = async (color: string) => {
    // Update local state immediately for responsiveness
    setPrimaryColor(color);

    // If user is logged in, persist to database
    if (user) {
      try {
        await fetch('/api/user/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accentColor: color }),
        });
      } catch (e) {
        console.error('Failed to save accent color:', e);
      }
    }
  };

  const colors = Object.keys(theme.colors).filter(
    (color) => color !== 'dark' && color !== 'gray' && color !== 'white' && color !== 'black'
  );

  // Check if a model (base name) is already installed
  // Returns list of installed tags for the given model name
  const getInstalledTags = (modelName: string): string[] => {
    return installedModels
      .filter((m) => {
        // Handle both "modelName:tag" and "modelName" (defaults to "latest")
        const [baseName] = m.name.split(':');
        return baseName === modelName;
      })
      .map((m) => {
        const parts = m.name.split(':');
        // If no tag specified, it's "latest"
        return parts.length > 1 ? parts[1] : 'latest';
      });
  };

  return (
    <Modal
      opened={opened}
      onClose={close}
      withCloseButton={false}
      size="xl"
      padding={0}
      radius="xl"
    >
      <Group align="stretch" gap={0} style={{ minHeight: 600, overflow: 'hidden' }}>
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
        <Stack p="xl" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
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
                      onClick={() => handleAccentColorChange(color)}
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
            <Stack gap="md" style={{ flex: 1, overflow: 'hidden' }}>
              <div>
                <Title order={4}>Models</Title>
                <Text size="sm" c="dimmed">
                  Download and manage AI models from the Ollama registry.
                </Text>
              </div>

              {pullError && (
                <Alert
                  icon={<IconAlertCircle size={16} />}
                  title="Error"
                  color="red"
                  withCloseButton
                  onClose={() => setPullError('')}
                >
                  {pullError}
                </Alert>
              )}

              {pullingModel && (
                <Alert icon={<Loader size={16} />} title="Downloading..." color="blue">
                  Pulling {pullingModel}. This may take a while.
                </Alert>
              )}

              <ScrollArea style={{ flex: 1 }} offsetScrollbars>
                <Stack gap="lg">
                  {/* Installed Models Section */}
                  <div>
                    <Group justify="space-between" mb="xs">
                      <Text size="sm" fw={600}>
                        Installed Models
                      </Text>
                      <Tooltip label="Refresh">
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="sm"
                          onClick={() => fetchInstalledModels(true)}
                          loading={loadingInstalled}
                        >
                          <IconRefresh size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>

                    {loadingInstalled && installedModels.length === 0 ? (
                      <Group justify="center" py="md">
                        <Loader size="sm" />
                      </Group>
                    ) : installedModels.length === 0 ? (
                      <Card withBorder padding="md" radius="md">
                        <Text c="dimmed" size="sm" ta="center">
                          No models installed yet. Browse available models below.
                        </Text>
                      </Card>
                    ) : (
                      <Stack gap="xs">
                        {installedModels.map((model) => (
                          <Card key={model.digest} withBorder padding="sm" radius="md">
                            <Group justify="space-between">
                              <div>
                                <Text fw={500} size="sm">
                                  {model.name}
                                </Text>
                                <Group gap="xs" mt={4}>
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
                    )}
                  </div>

                  <Divider />

                  {/* Available Models Section */}
                  <div>
                    <Group justify="space-between" mb="xs">
                      <Text size="sm" fw={600}>
                        Available Models
                      </Text>
                      {availableModels && (
                        <Text size="xs" c="dimmed">
                          {filteredModels.length === modelNames.length
                            ? `${modelNames.length} models`
                            : `${filteredModels.length} of ${modelNames.length} models`}
                        </Text>
                      )}
                    </Group>

                    <TextInput
                      placeholder="Search models..."
                      leftSection={<IconSearch size={16} />}
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.currentTarget.value)}
                      mb="sm"
                    />

                    {loadingAvailable ? (
                      <Group justify="center" py="md">
                        <Loader size="sm" />
                      </Group>
                    ) : (
                      <>
                        <Accordion variant="separated" radius="md">
                          {paginatedModels.map((modelName) => {
                            const tags = availableModels?.models[modelName] || [];
                            const installedTags = getInstalledTags(modelName);

                            return (
                              <Accordion.Item key={modelName} value={modelName}>
                                <Accordion.Control>
                                  <Group justify="space-between" pr="sm">
                                    <Text fw={500} size="sm">
                                      {modelName}
                                    </Text>
                                    <Group gap="xs">
                                      <Badge size="xs" variant="light" color="gray">
                                        {tags.length} tags
                                      </Badge>
                                      {installedTags.length > 0 && (
                                        <Badge size="xs" variant="light" color="green">
                                          {installedTags.length} installed
                                        </Badge>
                                      )}
                                    </Group>
                                  </Group>
                                </Accordion.Control>
                                <Accordion.Panel>
                                  <Stack gap="xs">
                                    {tags.map((tag) => {
                                      const isInstalled = installedTags.includes(tag);
                                      const isPulling = pullingModel === `${modelName}:${tag}`;

                                      return (
                                        <Group key={tag} justify="space-between">
                                          <Text size="sm" c={isInstalled ? 'dimmed' : undefined}>
                                            {modelName}:{tag}
                                          </Text>
                                          {isInstalled ? (
                                            <Badge size="xs" variant="light" color="green">
                                              Installed
                                            </Badge>
                                          ) : (
                                            <Button
                                              size="xs"
                                              variant="light"
                                              color={primaryColor}
                                              leftSection={<IconDownload size={14} />}
                                              onClick={() => handlePullModel(modelName, tag)}
                                              loading={isPulling}
                                              disabled={!!pullingModel}
                                            >
                                              Download
                                            </Button>
                                          )}
                                        </Group>
                                      );
                                    })}
                                  </Stack>
                                </Accordion.Panel>
                              </Accordion.Item>
                            );
                          })}
                        </Accordion>

                        {filteredModels.length === 0 && debouncedSearch && (
                          <Text c="dimmed" size="sm" ta="center" py="md">
                            No models found matching &quot;{debouncedSearch}&quot;
                          </Text>
                        )}

                        {totalPages > 1 && (
                          <Group justify="center" mt="md">
                            <Pagination
                              total={totalPages}
                              value={currentPage}
                              onChange={setCurrentPage}
                              size="sm"
                            />
                          </Group>
                        )}
                      </>
                    )}

                    {availableModels && (
                      <Text size="xs" c="dimmed" mt="md">
                        Model list updated:{' '}
                        {new Date(availableModels.generatedAt).toLocaleDateString()}
                      </Text>
                    )}
                  </div>
                </Stack>
              </ScrollArea>
            </Stack>
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
