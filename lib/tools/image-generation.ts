/**
 * Image Generation tool - generate images using Stable Diffusion or similar
 * Requires a compatible image generation API (e.g., Automatic1111, ComfyUI, or cloud service)
 */

import { Tool } from 'ollama';
import { ToolHandler, ToolResult } from './types';

// Image generation API endpoint (configurable via environment)
const IMAGE_API_URL = process.env.IMAGE_GENERATION_API_URL || '';

export const imageGenerationTool: Tool = {
  type: 'function',
  function: {
    name: 'generate_image',
    description:
      'Generate an image based on a text description. Creates images using AI image generation. ' +
      (IMAGE_API_URL
        ? 'Image generation is available.'
        : 'NOTE: Image generation is not configured. Set IMAGE_GENERATION_API_URL environment variable.'),
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description:
            'Detailed description of the image to generate. Be specific about style, colors, composition, etc.',
        },
        negative_prompt: {
          type: 'string',
          description: 'Things to avoid in the image (e.g., "blurry, low quality, distorted")',
        },
        width: {
          type: 'number',
          description: 'Image width in pixels (default: 512, max: 1024)',
        },
        height: {
          type: 'number',
          description: 'Image height in pixels (default: 512, max: 1024)',
        },
        style: {
          type: 'string',
          enum: ['realistic', 'artistic', 'anime', 'digital-art', 'photographic'],
          description: 'Art style for the image (default: artistic)',
        },
      },
      required: ['prompt'],
    },
  },
};

export const imageGenerationHandler: ToolHandler = async (args): Promise<ToolResult> => {
  const prompt = args.prompt as string;
  const negativePrompt = (args.negative_prompt as string) || 'blurry, low quality, distorted';
  const width = Math.min((args.width as number) || 512, 1024);
  const height = Math.min((args.height as number) || 512, 1024);
  const style = (args.style as string) || 'artistic';

  if (!prompt) {
    return {
      success: false,
      error: 'No prompt provided',
    };
  }

  if (!IMAGE_API_URL) {
    return {
      success: false,
      error:
        'Image generation is not configured. Please set the IMAGE_GENERATION_API_URL environment variable to point to a Stable Diffusion API (e.g., Automatic1111 or ComfyUI).',
    };
  }

  try {
    // Style-based prompt enhancement
    const stylePrompts: Record<string, string> = {
      realistic: 'photorealistic, highly detailed, 8k, professional photography',
      artistic: 'artistic, beautiful composition, masterpiece, best quality',
      anime: 'anime style, vibrant colors, clean lines, studio quality',
      'digital-art': 'digital art, concept art, detailed illustration',
      photographic: 'DSLR photo, natural lighting, sharp focus, high resolution',
    };

    const enhancedPrompt = `${prompt}, ${stylePrompts[style] || stylePrompts.artistic}`;

    // Make request to image generation API
    // This is configured for Automatic1111's API format
    const response = await fetch(`${IMAGE_API_URL}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: enhancedPrompt,
        negative_prompt: negativePrompt,
        width,
        height,
        steps: 20,
        cfg_scale: 7,
        sampler_name: 'Euler a',
      }),
      signal: AbortSignal.timeout(120000), // 2 minute timeout for generation
    });

    if (!response.ok) {
      throw new Error(`Image API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.images || data.images.length === 0) {
      throw new Error('No image was generated');
    }

    // Return base64 image data
    // The frontend will need to handle displaying this
    return {
      success: true,
      result: JSON.stringify({
        type: 'image',
        format: 'base64',
        data: data.images[0],
        prompt: enhancedPrompt,
        width,
        height,
      }),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate image',
    };
  }
};
