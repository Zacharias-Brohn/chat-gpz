/**
 * Weather tool - get current weather information
 * Uses Open-Meteo API (free, no API key required)
 */

import { Tool } from 'ollama';
import { ToolHandler, ToolResult } from './types';

export const weatherTool: Tool = {
  type: 'function',
  function: {
    name: 'get_weather',
    description:
      'Get current weather information for a location. Provides temperature, conditions, humidity, wind speed, and more.',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City name or location (e.g., "New York", "London, UK", "Tokyo, Japan")',
        },
        units: {
          type: 'string',
          enum: ['metric', 'imperial'],
          description:
            'Unit system: "metric" (Celsius, km/h) or "imperial" (Fahrenheit, mph). Default: metric',
        },
      },
      required: ['location'],
    },
  },
};

interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
}

interface WeatherData {
  temperature: number;
  apparent_temperature: number;
  humidity: number;
  wind_speed: number;
  wind_direction: number;
  weather_code: number;
  is_day: boolean;
}

// Weather code to description mapping
const weatherCodes: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

function getWindDirection(degrees: number): string {
  const directions = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

export const weatherHandler: ToolHandler = async (args): Promise<ToolResult> => {
  const location = args.location as string;
  const units = (args.units as 'metric' | 'imperial') || 'metric';

  if (!location) {
    return {
      success: false,
      error: 'No location provided',
    };
  }

  try {
    // First, geocode the location
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
    const geoResponse = await fetch(geoUrl, { signal: AbortSignal.timeout(10000) });

    if (!geoResponse.ok) {
      throw new Error('Failed to geocode location');
    }

    const geoData = await geoResponse.json();
    if (!geoData.results || geoData.results.length === 0) {
      return {
        success: false,
        error: `Location not found: "${location}"`,
      };
    }

    const geo: GeocodingResult = geoData.results[0];

    // Fetch weather data
    const tempUnit = units === 'imperial' ? 'fahrenheit' : 'celsius';
    const windUnit = units === 'imperial' ? 'mph' : 'kmh';

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}`;

    const weatherResponse = await fetch(weatherUrl, { signal: AbortSignal.timeout(10000) });

    if (!weatherResponse.ok) {
      throw new Error('Failed to fetch weather data');
    }

    const weatherData = await weatherResponse.json();
    const current = weatherData.current;

    const weather: WeatherData = {
      temperature: current.temperature_2m,
      apparent_temperature: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      wind_speed: current.wind_speed_10m,
      wind_direction: current.wind_direction_10m,
      weather_code: current.weather_code,
      is_day: current.is_day === 1,
    };

    const tempSymbol = units === 'imperial' ? '°F' : '°C';
    const speedSymbol = units === 'imperial' ? 'mph' : 'km/h';
    const condition = weatherCodes[weather.weather_code] || 'Unknown';
    const windDir = getWindDirection(weather.wind_direction);

    const locationName = geo.admin1
      ? `${geo.name}, ${geo.admin1}, ${geo.country}`
      : `${geo.name}, ${geo.country}`;

    const result = `Weather for ${locationName}:

Conditions: ${condition} (${weather.is_day ? 'Day' : 'Night'})
Temperature: ${weather.temperature}${tempSymbol}
Feels like: ${weather.apparent_temperature}${tempSymbol}
Humidity: ${weather.humidity}%
Wind: ${weather.wind_speed} ${speedSymbol} from ${windDir}`;

    return {
      success: true,
      result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get weather',
    };
  }
};
