'use client';

import { useEffect, useRef, useState } from 'react';
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
import { ToolCallDisplay } from './ToolCallDisplay';
import classes from './MarkdownMessage.module.css';
// Import KaTeX CSS for LaTeX rendering
import 'katex/dist/katex.min.css';

interface MarkdownMessageProps {
  content: string;
  isStreaming?: boolean;
}

interface ParsedToolCall {
  toolName: string;
  args: Record<string, unknown>;
  result: string;
}

interface ContentSegment {
  type: 'text' | 'tool';
  content?: string;
  toolCall?: ParsedToolCall;
}

/**
 * Parse content to extract tool calls and regular text segments
 */
function parseContentWithToolCalls(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const toolPattern = /<!--TOOL_START:(\w+):(\{.*?\})-->([\s\S]*?)<!--TOOL_END-->/g;

  let lastIndex = 0;
  let match;

  while ((match = toolPattern.exec(content)) !== null) {
    // Add text before this tool call
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index).trim();
      if (textBefore) {
        segments.push({ type: 'text', content: textBefore });
      }
    }

    // Parse the tool call
    const toolName = match[1];
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(match[2]);
    } catch {
      // Invalid JSON, use empty args
    }
    const result = match[3].trim();

    segments.push({
      type: 'tool',
      toolCall: { toolName, args, result },
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last tool call
  if (lastIndex < content.length) {
    const remainingText = content.slice(lastIndex).trim();
    if (remainingText) {
      segments.push({ type: 'text', content: remainingText });
    }
  }

  // If no tool calls found, return the whole content as text
  if (segments.length === 0 && content.trim()) {
    segments.push({ type: 'text', content });
  }

  return segments;
}

/**
 * Hook that tracks content changes and returns content with fade-in markers for new text
 */
function useStreamingContent(content: string, isStreaming: boolean) {
  const [processedContent, setProcessedContent] = useState(content);
  const prevContentRef = useRef('');
  const fadeIdRef = useRef(0);

  useEffect(() => {
    if (!isStreaming) {
      // When not streaming, just use the content directly (no animation spans)
      setProcessedContent(content);
      prevContentRef.current = content;
      return;
    }

    const prevContent = prevContentRef.current;
    const prevLength = prevContent.length;
    const currentLength = content.length;

    if (currentLength > prevLength) {
      // New content arrived - wrap it in a fade-in span
      const existingContent = content.slice(0, prevLength);
      const newContent = content.slice(prevLength);
      const fadeId = fadeIdRef.current++;

      // Wrap new content in a span with fade-in class
      // Use a unique key to force re-render of the animation
      const wrappedNew = `<span class="${classes.fadeIn}" data-fade-id="${fadeId}">${escapeHtml(newContent)}</span>`;

      setProcessedContent(existingContent + wrappedNew);
      prevContentRef.current = content;
    } else if (currentLength < prevLength) {
      // Content was reset
      setProcessedContent(content);
      prevContentRef.current = content;
      fadeIdRef.current = 0;
    }
  }, [content, isStreaming]);

  // When streaming ends, clean up the spans and show plain content
  useEffect(() => {
    if (!isStreaming && content) {
      setProcessedContent(content);
      prevContentRef.current = content;
    }
  }, [isStreaming, content]);

  return processedContent;
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Strip tool call markers from content for streaming display
 */
function stripToolMarkers(content: string): string {
  return content.replace(/<!--TOOL_START:\w+:\{.*?\}-->/g, '').replace(/<!--TOOL_END-->/g, '');
}

function MarkdownContent({ content }: { content: string }) {
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

        // Allow the fade-in spans to pass through
        span: ({ className, children }) => <span className={className}>{children}</span>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function MarkdownMessage({ content, isStreaming = false }: MarkdownMessageProps) {
  const processedContent = useStreamingContent(content, isStreaming);

  // During streaming, just show the raw content (with tool markers stripped)
  if (isStreaming) {
    return (
      <div className={classes.markdown}>
        <MarkdownContent content={stripToolMarkers(processedContent)} />
      </div>
    );
  }

  // When not streaming, parse and render tool calls
  const segments = parseContentWithToolCalls(content);

  return (
    <div className={classes.markdown}>
      {segments.map((segment, index) => {
        if (segment.type === 'tool' && segment.toolCall) {
          return (
            <ToolCallDisplay
              key={`tool-${index}`}
              toolName={segment.toolCall.toolName}
              args={segment.toolCall.args}
              result={segment.toolCall.result}
            />
          );
        }
        return <MarkdownContent key={`text-${index}`} content={segment.content || ''} />;
      })}
    </div>
  );
}
