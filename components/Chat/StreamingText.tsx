'use client';

import { useEffect, useRef, useState } from 'react';
import classes from './StreamingText.module.css';

interface StreamingTextProps {
  content: string;
  isStreaming: boolean;
}

/**
 * Component that renders text with a smooth fade-in animation for new chunks.
 * Splits content into "committed" (already visible) and "new" (fading in) portions.
 */
export function StreamingText({ content, isStreaming }: StreamingTextProps) {
  const [committedLength, setCommittedLength] = useState(0);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // When content grows, schedule the new content to become "committed" after animation
  useEffect(() => {
    if (content.length > committedLength) {
      // Clear any pending timeout
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }

      // After the fade-in animation completes, commit the new content
      animationTimeoutRef.current = setTimeout(() => {
        setCommittedLength(content.length);
      }, 300); // Match CSS animation duration
    }

    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [content, committedLength]);

  // When streaming stops, immediately commit all content
  useEffect(() => {
    if (!isStreaming) {
      setCommittedLength(content.length);
    }
  }, [isStreaming, content.length]);

  // Reset when content is cleared (new message)
  useEffect(() => {
    if (content.length === 0) {
      setCommittedLength(0);
    }
  }, [content]);

  const committedText = content.slice(0, committedLength);
  const newText = content.slice(committedLength);

  return (
    <span className={classes.streamingText}>
      <span>{committedText}</span>
      {newText && <span className={classes.fadeIn}>{newText}</span>}
    </span>
  );
}
