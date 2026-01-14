/**
 * URL Fetch tool - fetch and extract content from web pages
 */

import { Tool } from 'ollama';
import { ToolHandler, ToolResult } from './types';

export const urlFetchTool: Tool = {
  type: 'function',
  function: {
    name: 'fetch_url',
    description:
      'Fetch content from a URL and extract the main text. Useful for reading articles, documentation, or any web page content.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to fetch content from',
        },
        max_length: {
          type: 'number',
          description:
            'Maximum number of characters to return (default: 5000). Longer content will be truncated.',
        },
      },
      required: ['url'],
    },
  },
};

// Simple HTML to text conversion
function htmlToText(html: string): string {
  return (
    html
      // Remove scripts and styles
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Replace common block elements with newlines
      .replace(/<\/(p|div|h[1-6]|li|tr|br)[^>]*>/gi, '\n')
      .replace(/<(br|hr)[^>]*\/?>/gi, '\n')
      // Remove remaining HTML tags
      .replace(/<[^>]+>/g, ' ')
      // Decode common HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Clean up whitespace
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim()
  );
}

export const urlFetchHandler: ToolHandler = async (args): Promise<ToolResult> => {
  const url = args.url as string;
  const maxLength = (args.max_length as number) || 5000;

  if (!url) {
    return {
      success: false,
      error: 'No URL provided',
    };
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    return {
      success: false,
      error: 'Invalid URL format',
    };
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ChatGPZ/1.0; +https://github.com/your-repo)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const contentType = response.headers.get('content-type') || '';
    const html = await response.text();

    let text: string;
    if (contentType.includes('text/plain')) {
      text = html;
    } else {
      text = htmlToText(html);
    }

    // Truncate if needed
    if (text.length > maxLength) {
      text = `${text.substring(0, maxLength)}\n\n[Content truncated...]`;
    }

    return {
      success: true,
      result: `Content from ${url}:\n\n${text}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch URL',
    };
  }
};
