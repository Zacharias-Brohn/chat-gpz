'use client';

import { useState } from 'react';
import { IconChevronDown, IconChevronRight, IconTool } from '@tabler/icons-react';
import { ActionIcon, Code, Collapse, Group, Paper, Text, useMantineTheme } from '@mantine/core';
import { useThemeContext } from '@/components/DynamicThemeProvider';
import classes from './ToolCallDisplay.module.css';

export interface ToolCall {
  toolName: string;
  args: Record<string, unknown>;
  result: string;
}

interface ToolCallDisplayProps {
  toolName: string;
  args: Record<string, unknown>;
  result: string;
  nested?: boolean;
}

interface ToolCallGroupProps {
  toolCalls: ToolCall[];
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

function getDisplayName(toolName: string): string {
  return toolDisplayNames[toolName] || toolName;
}

/**
 * Display a single tool call (can be standalone or nested inside a group)
 */
export function ToolCallDisplay({ toolName, args, result, nested = false }: ToolCallDisplayProps) {
  const [opened, setOpened] = useState(false);
  const { primaryColor } = useThemeContext();
  const theme = useMantineTheme();

  const displayName = getDisplayName(toolName);
  const isError = result.startsWith('Error:');

  // Format args for display
  const argsDisplay = Object.entries(args)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(', ');

  const containerClass = nested ? classes.nestedContainer : classes.container;
  const headerClass = nested ? classes.nestedHeader : classes.header;
  const contentClass = nested ? classes.nestedContent : classes.content;

  return (
    <Paper className={containerClass} withBorder radius="sm" p={0} my={nested ? 0 : 'xs'}>
      <Group
        className={headerClass}
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
        <div className={contentClass}>
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

/**
 * Display a group of consecutive tool calls in a single collapsible container
 */
export function ToolCallGroup({ toolCalls }: ToolCallGroupProps) {
  const [opened, setOpened] = useState(false);
  const { primaryColor } = useThemeContext();
  const theme = useMantineTheme();

  if (toolCalls.length === 0) {
    return null;
  }

  // If only one tool call, render it directly without the group wrapper
  if (toolCalls.length === 1) {
    const tc = toolCalls[0];
    return <ToolCallDisplay toolName={tc.toolName} args={tc.args} result={tc.result} />;
  }

  // Get summary of tool names
  const toolNames = toolCalls.map((tc) => getDisplayName(tc.toolName));
  const uniqueTools = Array.from(new Set(toolNames));
  const summary =
    uniqueTools.length <= 2
      ? uniqueTools.join(', ')
      : `${uniqueTools.slice(0, 2).join(', ')} +${uniqueTools.length - 2} more`;

  return (
    <Paper className={classes.groupContainer} withBorder radius="sm" p={0} my="xs">
      <Group
        className={classes.groupHeader}
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
          {toolCalls.length} Tool Calls
        </Text>
        <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>
          {summary}
        </Text>
      </Group>

      <Collapse in={opened}>
        <div className={classes.groupContent}>
          {toolCalls.map((tc, index) => (
            <ToolCallDisplay
              key={index}
              toolName={tc.toolName}
              args={tc.args}
              result={tc.result}
              nested
            />
          ))}
        </div>
      </Collapse>
    </Paper>
  );
}
