'use client';

import { useState } from 'react';
import { IconChevronDown, IconChevronRight, IconTool } from '@tabler/icons-react';
import { ActionIcon, Code, Collapse, Group, Paper, Text, useMantineTheme } from '@mantine/core';
import { useThemeContext } from '@/components/DynamicThemeProvider';
import classes from './ToolCallDisplay.module.css';

interface ToolCallDisplayProps {
  toolName: string;
  args: Record<string, unknown>;
  result: string;
}

// Friendly tool names
const toolDisplayNames: Record<string, string> = {
  calculator: 'Calculator',
  get_current_datetime: 'Date/Time',
  fetch_url: 'Fetch URL',
  web_search: 'Web Search',
  execute_code: 'Code Execution',
  read_file: 'Read File',
  write_file: 'Write File',
  get_weather: 'Weather',
  generate_image: 'Image Generation',
};

export function ToolCallDisplay({ toolName, args, result }: ToolCallDisplayProps) {
  const [opened, setOpened] = useState(false);
  const { primaryColor } = useThemeContext();
  const theme = useMantineTheme();

  const displayName = toolDisplayNames[toolName] || toolName;
  const isError = result.startsWith('Error:');

  // Format args for display
  const argsDisplay = Object.entries(args)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(', ');

  return (
    <Paper className={classes.container} withBorder radius="sm" p={0} my="xs">
      <Group
        className={classes.header}
        onClick={() => setOpened(!opened)}
        gap="xs"
        wrap="nowrap"
        p="xs"
        style={{ cursor: 'pointer' }}
      >
        <ActionIcon variant="subtle" color={primaryColor} size="xs">
          {opened ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </ActionIcon>
        <IconTool size={16} color={theme.colors[primaryColor][6]} />
        <Text size="sm" fw={500} c={primaryColor}>
          {displayName}
        </Text>
        {!opened && argsDisplay && (
          <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>
            {argsDisplay}
          </Text>
        )}
      </Group>

      <Collapse in={opened}>
        <div className={classes.content}>
          {Object.keys(args).length > 0 && (
            <div className={classes.section}>
              <Text size="xs" c="dimmed" mb={4}>
                Arguments:
              </Text>
              <Code block className={classes.code}>
                {JSON.stringify(args, null, 2)}
              </Code>
            </div>
          )}
          <div className={classes.section}>
            <Text size="xs" c="dimmed" mb={4}>
              Result:
            </Text>
            <Code block className={classes.code} c={isError ? 'red' : undefined}>
              {result}
            </Code>
          </div>
        </div>
      </Collapse>
    </Paper>
  );
}
