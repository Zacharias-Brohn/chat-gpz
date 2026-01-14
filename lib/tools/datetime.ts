/**
 * Date/Time tool - get current date, time, and timezone information
 */

import { Tool } from 'ollama';
import { ToolHandler, ToolResult } from './types';

export const dateTimeTool: Tool = {
  type: 'function',
  function: {
    name: 'get_current_datetime',
    description: 'Get the current date and time. Can return in different formats and timezones.',
    parameters: {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description:
            'IANA timezone name (e.g., "America/New_York", "Europe/London", "Asia/Tokyo"). Defaults to server timezone if not specified.',
        },
        format: {
          type: 'string',
          enum: ['iso', 'readable', 'date_only', 'time_only', 'unix'],
          description:
            'Output format: "iso" (ISO 8601), "readable" (human readable), "date_only", "time_only", or "unix" (Unix timestamp). Defaults to "readable".',
        },
      },
      required: [],
    },
  },
};

export const dateTimeHandler: ToolHandler = async (args): Promise<ToolResult> => {
  const timezone = (args.timezone as string) || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const format = (args.format as string) || 'readable';

  try {
    const now = new Date();

    let result: string;

    switch (format) {
      case 'iso':
        result = `${now.toLocaleString('sv-SE', { timeZone: timezone }).replace(' ', 'T')}Z`;
        break;
      case 'date_only':
        result = now.toLocaleDateString('en-US', {
          timeZone: timezone,
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        break;
      case 'time_only':
        result = now.toLocaleTimeString('en-US', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
        break;
      case 'unix':
        result = Math.floor(now.getTime() / 1000).toString();
        break;
      case 'readable':
      default:
        result = now.toLocaleString('en-US', {
          timeZone: timezone,
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          timeZoneName: 'short',
        });
        break;
    }

    return {
      success: true,
      result: `Current date/time (${timezone}): ${result}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get date/time',
    };
  }
};
