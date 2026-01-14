'use client';

import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import {
  Anchor,
  Blockquote,
  Checkbox,
  Code,
  Divider,
  List,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolCall, ToolCallGroup } from './ToolCallDisplay';
import classes from './MarkdownMessage.module.css';
// Import KaTeX CSS for LaTeX rendering
import 'katex/dist/katex.min.css';

interface MarkdownMessageProps {
  content: string;
  isStreaming?: boolean;
}

/**
 * Parsed segment with streaming state
 */
interface ParsedSegment {
  type: 'text' | 'thinking' | 'toolGroup';
  content?: string;
  toolCalls?: ToolCall[];
  isStreaming?: boolean; // True if this segment is still being streamed
}

/**
 * Clean text content by removing text-based tool call patterns
 */
function cleanTextContent(text: string): string {
  return text
    .replace(/\w+\[ARGS\]\{[^}]*\}/g, '') // Remove tool_name[ARGS]{...} patterns
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '') // Remove <tool_call>...</tool_call>
    .replace(/\{[\s\S]*?"(?:tool|function)"[\s\S]*?\}/g, '') // Remove JSON tool objects
    .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
    .trim();
}

/**
 * Parse content into segments, handling both complete and incomplete (streaming) blocks
 */
function parseContentRealtime(content: string, isStreaming: boolean): ParsedSegment[] {
  const segments: ParsedSegment[] = [];

  // Check for incomplete thinking block (opened but not closed)
  const hasOpenThink = content.includes('<think>');
  const hasCloseThink = content.includes('</think>');
  const isThinkingIncomplete = hasOpenThink && !hasCloseThink;

  // Check for incomplete tool call
  const hasOpenTool = content.includes('<!--TOOL_START:');
  const lastToolEndIndex = content.lastIndexOf('<!--TOOL_END-->');
  const lastToolStartIndex = content.lastIndexOf('<!--TOOL_START:');
  const isToolIncomplete = hasOpenTool && lastToolStartIndex > lastToolEndIndex;

  // Pattern for complete blocks only
  const combinedPattern =
    /(<think>([\s\S]*?)<\/think>)|<!--TOOL_START:(\w+):(\{.*?\})-->([\s\S]*?)<!--TOOL_END-->/g;

  let lastIndex = 0;
  let match;
  let currentToolGroup: ToolCall[] = [];

  // Helper to flush tool group
  const flushToolGroup = (streaming = false) => {
    if (currentToolGroup.length > 0) {
      segments.push({
        type: 'toolGroup',
        toolCalls: [...currentToolGroup],
        isStreaming: streaming,
      });
      currentToolGroup = [];
    }
  };

  // Helper to add text segment
  const addTextSegment = (text: string, streaming = false) => {
    const cleaned = cleanTextContent(text);
    if (cleaned) {
      flushToolGroup(); // Flush any pending tools before text
      segments.push({ type: 'text', content: cleaned, isStreaming: streaming });
    }
  };

  while ((match = combinedPattern.exec(content)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      addTextSegment(content.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // Complete thinking block
      flushToolGroup();
      const thinkingContent = match[2].trim();
      if (thinkingContent) {
        segments.push({ type: 'thinking', content: thinkingContent, isStreaming: false });
      }
    } else if (match[3]) {
      // Complete tool call - add to current group
      const toolName = match[3];
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(match[4]);
      } catch {
        // Invalid JSON, use empty args
      }
      const result = match[5].trim();
      currentToolGroup.push({ toolName, args, result });
    }

    lastIndex = match.index + match[0].length;
  }

  // Handle remaining content after last complete match
  const remaining = content.slice(lastIndex);

  if (isThinkingIncomplete) {
    // We have an open <think> tag - extract the thinking content
    flushToolGroup();
    const thinkStartIndex = remaining.indexOf('<think>');
    if (thinkStartIndex !== -1) {
      // Text before <think>
      const textBefore = remaining.slice(0, thinkStartIndex);
      addTextSegment(textBefore);

      // Thinking content (everything after <think>)
      const thinkingContent = remaining.slice(thinkStartIndex + 7).trim();
      if (thinkingContent) {
        segments.push({ type: 'thinking', content: thinkingContent, isStreaming: true });
      } else {
        // Empty thinking block that just started
        segments.push({ type: 'thinking', content: '', isStreaming: true });
      }
    }
  } else if (isToolIncomplete) {
    // We have an incomplete tool call
    // First, add any complete text before the incomplete tool
    const toolStartMatch = remaining.match(/<!--TOOL_START:(\w+):(\{.*?\})-->/);
    if (toolStartMatch && toolStartMatch.index !== undefined) {
      const textBefore = remaining.slice(0, toolStartMatch.index);
      addTextSegment(textBefore);

      // Parse the incomplete tool call
      const toolName = toolStartMatch[1];
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(toolStartMatch[2]);
      } catch {
        // Invalid JSON
      }
      // Result is everything after the start marker (still streaming)
      const resultStart = toolStartMatch.index + toolStartMatch[0].length;
      const partialResult = remaining.slice(resultStart).trim();

      currentToolGroup.push({ toolName, args, result: partialResult || 'Loading...' });
      flushToolGroup(true); // Mark as streaming
    } else {
      addTextSegment(remaining, isStreaming);
    }
  } else {
    // No incomplete blocks - just add remaining text
    addTextSegment(remaining, isStreaming && remaining.length > 0);
  }

  // Flush any remaining tool group
  flushToolGroup();

  return segments;
}

function MarkdownContent({ content }: { content: string }) {
  if (!content.trim()) {
    return null;
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeRaw, rehypeKatex]}
      components={{
        // Headings
        h1: ({ children }) => (
          <Title order={2} mb="xs">
            {children}
          </Title>
        ),
        h2: ({ children }) => (
          <Title order={3} mb="xs">
            {children}
          </Title>
        ),
        h3: ({ children }) => (
          <Title order={4} mb="xs">
            {children}
          </Title>
        ),
        h4: ({ children }) => (
          <Title order={5} mb="xs">
            {children}
          </Title>
        ),
        h5: ({ children }) => (
          <Title order={6} mb="xs">
            {children}
          </Title>
        ),
        h6: ({ children }) => (
          <Text size="sm" fw={700} mb="xs">
            {children}
          </Text>
        ),

        // Paragraphs and text
        p: ({ children }) => (
          <Text size="sm" style={{ lineHeight: 1.6, marginBottom: '0.5em' }}>
            {children}
          </Text>
        ),
        strong: ({ children }) => (
          <Text component="strong" fw={700} inherit>
            {children}
          </Text>
        ),
        em: ({ children }) => (
          <Text component="em" fs="italic" inherit>
            {children}
          </Text>
        ),
        del: ({ children }) => (
          <Text component="del" td="line-through" inherit>
            {children}
          </Text>
        ),

        // Code
        code: ({ className, children }) => {
          const isInline = !className;
          if (isInline) {
            return <Code>{children}</Code>;
          }
          return (
            <Code block className={classes.codeBlock}>
              {children}
            </Code>
          );
        },
        pre: ({ children }) => <div className={classes.preWrapper}>{children}</div>,

        // Lists
        ul: ({ children, className }) => {
          // Check if this is a task list (GFM)
          if (className?.includes('contains-task-list')) {
            return <ul className={classes.taskList}>{children}</ul>;
          }
          return (
            <List size="sm" mb="xs">
              {children}
            </List>
          );
        },
        ol: ({ children }) => (
          <List type="ordered" size="sm" mb="xs">
            {children}
          </List>
        ),
        li: ({ children, className }) => {
          // Task list items have a checkbox
          if (className?.includes('task-list-item')) {
            return <li className={classes.taskListItem}>{children}</li>;
          }
          return <List.Item>{children}</List.Item>;
        },
        input: ({ checked, type }) => {
          if (type === 'checkbox') {
            return <Checkbox checked={checked} readOnly size="xs" mr="xs" />;
          }
          return null;
        },

        // Links and media
        a: ({ href, children }) => (
          <Anchor href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </Anchor>
        ),
        img: ({ src, alt }) => {
          const imgSrc = typeof src === 'string' ? src : '';
          return (
            <span className={classes.imageWrapper}>
              <Image
                src={imgSrc}
                alt={alt || ''}
                width={600}
                height={400}
                style={{ maxWidth: '100%', height: 'auto' }}
                unoptimized // Allow external images
              />
            </span>
          );
        },

        // Block elements
        blockquote: ({ children }) => <Blockquote mb="xs">{children}</Blockquote>,
        hr: () => <Divider my="md" />,

        // Tables (GFM)
        table: ({ children }) => (
          <Table
            striped
            highlightOnHover
            withTableBorder
            withColumnBorders
            mb="md"
            className={classes.table}
          >
            {children}
          </Table>
        ),
        thead: ({ children }) => <Table.Thead>{children}</Table.Thead>,
        tbody: ({ children }) => <Table.Tbody>{children}</Table.Tbody>,
        tr: ({ children }) => <Table.Tr>{children}</Table.Tr>,
        th: ({ children }) => <Table.Th>{children}</Table.Th>,
        td: ({ children }) => <Table.Td>{children}</Table.Td>,

        // Allow custom spans to pass through
        span: ({ className, children }) => <span className={className}>{children}</span>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function MarkdownMessage({ content, isStreaming = false }: MarkdownMessageProps) {
  // Parse content into segments (works for both streaming and complete content)
  const segments = parseContentRealtime(content, isStreaming);

  // If no segments, show nothing
  if (segments.length === 0) {
    return null;
  }

  return (
    <div className={classes.markdown}>
      {segments.map((segment, index) => {
        if (segment.type === 'thinking') {
          return (
            <ThinkingBlock
              key={`thinking-${index}`}
              content={segment.content || ''}
              isStreaming={segment.isStreaming}
            />
          );
        }
        if (segment.type === 'toolGroup' && segment.toolCalls) {
          return (
            <ToolCallGroup
              key={`toolgroup-${index}`}
              toolCalls={segment.toolCalls}
              isStreaming={segment.isStreaming}
            />
          );
        }
        return <MarkdownContent key={`text-${index}`} content={segment.content || ''} />;
      })}
    </div>
  );
}
