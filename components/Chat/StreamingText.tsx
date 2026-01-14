'use client';

import { useEffect, useRef, useState } from 'react';
import classes from './StreamingText.module.css';

interface StreamingTextProps {
  content: string;
  isStreaming: boolean;
}

interface TextChunk {
  id: number;
  text: string;
}

/**
 * Component that renders text with a smooth fade-in animation for new chunks.
 * Each chunk gets its own span element with a fade-in animation.
 */
export function StreamingText({ content, isStreaming }: StreamingTextProps) {
  const [chunks, setChunks] = useState<TextChunk[]>([]);
  const prevLengthRef = useRef(0);
  const chunkIdRef = useRef(0);

  useEffect(() => {
    const prevLength = prevLengthRef.current;
    const currentLength = content.length;

    if (currentLength > prevLength) {
      // New content arrived - create a new chunk for it
      const newText = content.slice(prevLength);
      const newChunk: TextChunk = {
        id: chunkIdRef.current++,
        text: newText,
      };
      setChunks((prev) => [...prev, newChunk]);
      prevLengthRef.current = currentLength;
    } else if (currentLength < prevLength) {
      // Content was reset (new message)
      setChunks([]);
      prevLengthRef.current = 0;
      chunkIdRef.current = 0;
    }
  }, [content]);

  // When streaming stops, consolidate all chunks into one (removes animations)
  useEffect(() => {
    if (!isStreaming && content.length > 0) {
      setChunks([{ id: 0, text: content }]);
      prevLengthRef.current = content.length;
    }
  }, [isStreaming, content]);

  return (
    <span className={classes.streamingText}>
      {chunks.map((chunk) => (
        <span key={chunk.id} className={isStreaming ? classes.fadeIn : undefined}>
          {chunk.text}
        </span>
      ))}
    </span>
  );
}
