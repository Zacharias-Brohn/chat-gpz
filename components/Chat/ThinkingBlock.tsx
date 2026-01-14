'use client';

import { useState } from 'react';
import { IconBrain, IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { ActionIcon, Collapse, Group, Paper, Text, useMantineTheme } from '@mantine/core';
import { useThemeContext } from '@/components/DynamicThemeProvider';
import classes from './ThinkingBlock.module.css';

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
}

/**
 * Collapsible block for displaying model reasoning/thinking content
 */
export function ThinkingBlock({ content, isStreaming = false }: ThinkingBlockProps) {
  const [opened, setOpened] = useState(false);
  const { primaryColor } = useThemeContext();
  const theme = useMantineTheme();

  // Don't render if no content
  if (!content.trim()) {
    return null;
  }

  // Count approximate "thoughts" or lines for summary
  const lines = content.trim().split('\n').filter(Boolean);
  const wordCount = content.trim().split(/\s+/).length;

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
        <IconBrain size={16} color={theme.colors[primaryColor][6]} />
        <Text size="sm" fw={500} c={primaryColor}>
          {isStreaming ? 'Thinking...' : 'Reasoning'}
        </Text>
        {!opened && (
          <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>
            {isStreaming ? 'Model is reasoning...' : `${wordCount} words, ${lines.length} steps`}
          </Text>
        )}
      </Group>

      <Collapse in={opened}>
        <div className={classes.content}>
          <Text size="xs" c="dimmed" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {content}
          </Text>
        </div>
      </Collapse>
    </Paper>
  );
}
