'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { Anchor, Blockquote, Code, List, Text, Title } from '@mantine/core';
import classes from './MarkdownMessage.module.css';

interface MarkdownMessageProps {
  content: string;
  isStreaming?: boolean;
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

export function MarkdownMessage({ content, isStreaming = false }: MarkdownMessageProps) {
  const processedContent = useStreamingContent(content, isStreaming);

  return (
    <div className={classes.markdown}>
      <ReactMarkdown
        rehypePlugins={[rehypeRaw]}
        components={{
          p: ({ children }) => (
            <Text size="sm" style={{ lineHeight: 1.6, marginBottom: '0.5em' }}>
              {children}
            </Text>
          ),
          h1: ({ children }) => (
            <Title order={3} mb="xs">
              {children}
            </Title>
          ),
          h2: ({ children }) => (
            <Title order={4} mb="xs">
              {children}
            </Title>
          ),
          h3: ({ children }) => (
            <Title order={5} mb="xs">
              {children}
            </Title>
          ),
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
          ul: ({ children }) => (
            <List size="sm" mb="xs">
              {children}
            </List>
          ),
          ol: ({ children }) => (
            <List type="ordered" size="sm" mb="xs">
              {children}
            </List>
          ),
          li: ({ children }) => <List.Item>{children}</List.Item>,
          a: ({ href, children }) => (
            <Anchor href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </Anchor>
          ),
          blockquote: ({ children }) => <Blockquote mb="xs">{children}</Blockquote>,
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
          // Allow the fade-in spans to pass through
          span: ({ className, children }) => <span className={className}>{children}</span>,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
