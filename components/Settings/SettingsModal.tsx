import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconAlertCircle,
  IconDownload,
  IconPalette,
  IconRefresh,
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
  Tooltip,
  useCombobox,
  useMantineTheme,
} from '@mantine/core';
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

  // Selected model and tag for downloading
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');

  // Combobox states
  const [modelSearch, setModelSearch] = useState('');
  const [tagSearch, setTagSearch] = useState('');

  const modelCombobox = useCombobox({
    onDropdownClose: () => {
      modelCombobox.resetSelectedOption();
      modelCombobox.focusTarget();
      setModelSearch('');
    },
    onDropdownOpen: () => {
      modelCombobox.focusSearchInput();
    },
  });

  const tagCombobox = useCombobox({
    onDropdownClose: () => {
      tagCombobox.resetSelectedOption();
      tagCombobox.focusTarget();
      setTagSearch('');
    },
    onDropdownOpen: () => {
      tagCombobox.focusSearchInput();
    },
  });

  // Track if we've fetched this session
  const hasFetchedInstalled = useRef(false);
  const hasFetchedAvailable = useRef(false);

  // Get list of model names for the dropdown
  const modelNames = availableModels ? Object.keys(availableModels.models).sort() : [];

  // Filter models based on search
  const filteredModels = modelNames.filter((name) =>
    name.toLowerCase().includes(modelSearch.toLowerCase().trim())
  );

  // Get tags for the selected model
  const availableTags =
    selectedModel && availableModels ? availableModels.models[selectedModel] || [] : [];

  // Filter tags based on search
  const filteredTags = availableTags.filter((tag) =>
    tag.toLowerCase().includes(tagSearch.toLowerCase().trim())
  );

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

  const handlePullModel = async () => {
    if (!selectedModel) {
      return;
    }

    // Build the full model name with tag
    const fullModelName = selectedTag ? `${selectedModel}:${selectedTag}` : selectedModel;

    setPullingModel(fullModelName);
    setPullError('');

    try {
      const result = await pullModel(fullModelName);
      if (result.success) {
        setSelectedModel('');
        setSelectedTag('');
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

  // When model selection changes, reset tag
  const handleModelSelect = (model: string) => {
    setSelectedModel(model);
    setSelectedTag('');
    modelCombobox.closeDropdown();
  };

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
            <>
              <Title order={4}>Models</Title>
              <Text size="sm" c="dimmed">
                Download and manage AI models from the Ollama registry.
              </Text>
              <Divider my="sm" />

              {/* Model Selection */}
              <Text size="sm" fw={500} mb="xs">
                Download New Model
              </Text>

              <Group align="flex-end" gap="sm">
                {/* Model Name Dropdown */}
                <Combobox
                  store={modelCombobox}
                  withinPortal={false}
                  onOptionSubmit={handleModelSelect}
                >
                  <Combobox.Target>
                    <InputBase
                      component="button"
                      type="button"
                      pointer
                      rightSection={loadingAvailable ? <Loader size={14} /> : <Combobox.Chevron />}
                      onClick={() => modelCombobox.toggleDropdown()}
                      rightSectionPointerEvents="none"
                      label="Model"
                      style={{ minWidth: 180 }}
                    >
                      {selectedModel || <Input.Placeholder>Select model</Input.Placeholder>}
                    </InputBase>
                  </Combobox.Target>

                  <Combobox.Dropdown>
                    <Combobox.Search
                      value={modelSearch}
                      onChange={(event) => setModelSearch(event.currentTarget.value)}
                      placeholder="Search models..."
                    />
                    <Combobox.Options>
                      <ScrollArea.Autosize type="scroll" mah={200}>
                        {filteredModels.length > 0 ? (
                          filteredModels.map((name) => (
                            <Combobox.Option value={name} key={name}>
                              {name}
                            </Combobox.Option>
                          ))
                        ) : (
                          <Combobox.Empty>No models found</Combobox.Empty>
                        )}
                      </ScrollArea.Autosize>
                    </Combobox.Options>
                  </Combobox.Dropdown>
                </Combobox>

                {/* Tag/Quantization Dropdown */}
                <Combobox
                  store={tagCombobox}
                  withinPortal={false}
                  onOptionSubmit={(val) => {
                    setSelectedTag(val);
                    tagCombobox.closeDropdown();
                  }}
                >
                  <Combobox.Target>
                    <InputBase
                      component="button"
                      type="button"
                      pointer
                      rightSection={<Combobox.Chevron />}
                      onClick={() => tagCombobox.toggleDropdown()}
                      rightSectionPointerEvents="none"
                      label="Tag"
                      disabled={!selectedModel}
                      style={{ minWidth: 180 }}
                    >
                      {selectedTag || (
                        <Input.Placeholder>
                          {selectedModel ? 'Select tag (optional)' : 'Select model first'}
                        </Input.Placeholder>
                      )}
                    </InputBase>
                  </Combobox.Target>

                  <Combobox.Dropdown>
                    <Combobox.Search
                      value={tagSearch}
                      onChange={(event) => setTagSearch(event.currentTarget.value)}
                      placeholder="Search tags..."
                    />
                    <Combobox.Options>
                      <ScrollArea.Autosize type="scroll" mah={200}>
                        {filteredTags.length > 0 ? (
                          filteredTags.map((tag) => (
                            <Combobox.Option value={tag} key={tag}>
                              {tag}
                            </Combobox.Option>
                          ))
                        ) : (
                          <Combobox.Empty>No tags found</Combobox.Empty>
                        )}
                      </ScrollArea.Autosize>
                    </Combobox.Options>
                  </Combobox.Dropdown>
                </Combobox>

                <Button
                  onClick={handlePullModel}
                  loading={!!pullingModel}
                  disabled={!selectedModel}
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

              {pullError && (
                <Alert
                  icon={<IconAlertCircle size={16} />}
                  title="Error"
                  color="red"
                  mt="md"
                  withCloseButton
                  onClose={() => setPullError('')}
                >
                  {pullError}
                </Alert>
              )}

              {/* Installed Models */}
              <Group justify="space-between" mt="xl" mb="xs">
                <Text size="sm" fw={500}>
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
                <Group justify="center" py="xl">
                  <Loader size="sm" />
                </Group>
              ) : installedModels.length === 0 ? (
                <Text c="dimmed" size="sm" ta="center" py="xl">
                  No models installed. Pull one from above!
                </Text>
              ) : (
                <ScrollArea h={200} offsetScrollbars>
                  <Stack gap="xs">
                    {installedModels.map((model) => (
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

              {availableModels && (
                <Text size="xs" c="dimmed" mt="md">
                  Model list last updated:{' '}
                  {new Date(availableModels.generatedAt).toLocaleDateString()}
                </Text>
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
