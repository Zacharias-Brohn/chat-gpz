import ReactMarkdown from 'react-markdown';
import { Anchor, Blockquote, Code, List, Text, Title } from '@mantine/core';
import classes from './MarkdownMessage.module.css';

interface MarkdownMessageProps {
  content: string;
  isStreaming?: boolean;
}

export function MarkdownMessage({ content, isStreaming = false }: MarkdownMessageProps) {
  return (
    <div className={classes.markdown}>
      <ReactMarkdown
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
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && <span className={classes.streamingCursor} />}
    </div>
  );
}
