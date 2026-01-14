/**
 * Web Search tool - search the internet using DuckDuckGo or SearXNG
 */

import { Tool } from 'ollama';
import { ToolHandler, ToolResult } from './types';

export const webSearchTool: Tool = {
  type: 'function',
  function: {
    name: 'web_search',
    description:
      'Search the internet for current information. Returns a list of relevant search results with titles, URLs, and snippets.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
        num_results: {
          type: 'number',
          description: 'Number of results to return (default: 5, max: 10)',
        },
      },
      required: ['query'],
    },
  },
};

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// DuckDuckGo HTML search (no API key needed)
async function searchDuckDuckGo(query: string, numResults: number): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Search failed: HTTP ${response.status}`);
  }

  const html = await response.text();
  const results: SearchResult[] = [];

  // Parse results from DDG HTML
  // Results are in <div class="result"> elements
  const resultRegex =
    /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([^<]*(?:<[^>]+>[^<]*)*)<\/a>/gi;

  let match;
  while ((match = resultRegex.exec(html)) !== null && results.length < numResults) {
    const url = match[1];
    const title = match[2].trim();
    const snippet = match[3].replace(/<[^>]+>/g, '').trim();

    if (url && title && !url.startsWith('/')) {
      results.push({ title, url, snippet });
    }
  }

  // Fallback: try alternative parsing if no results
  if (results.length === 0) {
    const altRegex =
      /<div class="result[^"]*"[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<\/a>[\s\S]*?class="result__title"[^>]*>([^<]+)/gi;

    while ((match = altRegex.exec(html)) !== null && results.length < numResults) {
      const url = match[1];
      const title = match[2].trim();

      if (url && title && !url.startsWith('/')) {
        results.push({ title, url, snippet: '' });
      }
    }
  }

  return results;
}

export const webSearchHandler: ToolHandler = async (args): Promise<ToolResult> => {
  const query = args.query as string;
  const numResults = Math.min((args.num_results as number) || 5, 10);

  if (!query) {
    return {
      success: false,
      error: 'No search query provided',
    };
  }

  try {
    const results = await searchDuckDuckGo(query, numResults);

    if (results.length === 0) {
      return {
        success: true,
        result: `No search results found for: "${query}"`,
      };
    }

    const formatted = results
      .map(
        (r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}${r.snippet ? `\n   ${r.snippet}` : ''}`
      )
      .join('\n\n');

    return {
      success: true,
      result: `Search results for "${query}":\n\n${formatted}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Search failed',
    };
  }
};
