#!/usr/bin/env node
/**
 * Scrapes available Ollama models and their tags from ollama.com
 * Outputs a JSON file that can be used by the frontend for model selection.
 *
 * Usage: node scripts/scrape-ollama-models.mjs
 */
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const OLLAMA_LIBRARY_URL = 'https://ollama.com/library';

/**
 * Fetches the list of all available models with their capabilities from Ollama's library page
 * @returns {Promise<Array<{name: string, capabilities: string[]}>>}
 */
async function fetchModelsWithCapabilities() {
  console.log('Fetching model list from Ollama library...');
  const response = await fetch(OLLAMA_LIBRARY_URL);
  const html = await response.text();

  // Parse models and their capabilities from the HTML
  // Each model is in a <li x-test-model> block
  const modelBlocks = html.split('<li x-test-model');
  const models = [];

  for (let i = 1; i < modelBlocks.length; i++) {
    const block = modelBlocks[i];

    // Extract model name from href="/library/modelname"
    const nameMatch = block.match(/href="\/library\/([^"\/]+)"/);
    if (!nameMatch) continue;

    const name = nameMatch[1];
    if (name.includes('/') || name.includes(':')) continue;

    // Extract capabilities from x-test-capability spans
    const capabilities = [];
    const capabilityRegex = /x-test-capability[^>]*>([^<]+)</g;
    let capMatch;
    while ((capMatch = capabilityRegex.exec(block)) !== null) {
      const cap = capMatch[1].trim().toLowerCase();
      if (cap && !capabilities.includes(cap)) {
        capabilities.push(cap);
      }
    }

    models.push({ name, capabilities });
  }

  console.log(`Found ${models.length} models`);
  return models;
}

/**
 * Fetches available tags for a specific model
 */
async function fetchModelTags(modelName) {
  const url = `${OLLAMA_LIBRARY_URL}/${modelName}/tags`;
  try {
    const response = await fetch(url);
    const html = await response.text();

    // Extract tags using regex (matches /library/modelname:tagname)
    const tagRegex = new RegExp(`/library/${modelName}:([^"]+)"`, 'g');
    const tags = new Set();
    let match;

    while ((match = tagRegex.exec(html)) !== null) {
      tags.add(match[1]);
    }

    return Array.from(tags);
  } catch (error) {
    console.error(`Error fetching tags for ${modelName}:`, error.message);
    return [];
  }
}

/**
 * Main function to scrape all models and their tags
 */
async function main() {
  const startTime = Date.now();

  // Fetch all models with their capabilities
  const modelList = await fetchModelsWithCapabilities();

  // Fetch tags for each model (with concurrency limit to be nice to the server)
  const CONCURRENCY = 5;
  const models = {};

  for (let i = 0; i < modelList.length; i += CONCURRENCY) {
    const batch = modelList.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async ({ name, capabilities }) => {
        const tags = await fetchModelTags(name);
        return { name, tags, capabilities };
      })
    );

    for (const { name, tags, capabilities } of results) {
      models[name] = {
        tags,
        capabilities,
      };
      console.log(`  ${name}: ${tags.length} tags, capabilities: [${capabilities.join(', ')}]`);
    }
  }

  // Create output structure
  const output = {
    generatedAt: new Date().toISOString(),
    modelCount: Object.keys(models).length,
    models,
  };

  // Write to public directory so it can be served statically
  const outputPath = join(__dirname, '..', 'public', 'ollama-models.json');
  writeFileSync(outputPath, JSON.stringify(output, null, 2));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone! Scraped ${Object.keys(models).length} models in ${elapsed}s`);
  console.log(`Output written to: ${outputPath}`);
}

main().catch(console.error);
