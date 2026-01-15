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
 * Fetches the list of all available model names from Ollama's library page
 */
async function fetchModelNames() {
  console.log('Fetching model list from Ollama library...');
  const response = await fetch(OLLAMA_LIBRARY_URL);
  const html = await response.text();

  // Extract model names using regex (matches href="/library/modelname")
  const modelRegex = /href="\/library\/([^"\/]+)"/g;
  const models = new Set();
  let match;

  while ((match = modelRegex.exec(html)) !== null) {
    // Filter out non-model links (like "tags" subpages)
    const name = match[1];
    if (name && !name.includes('/') && !name.includes(':')) {
      models.add(name);
    }
  }

  const modelList = Array.from(models);
  console.log(`Found ${modelList.length} models`);
  return modelList;
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

  // Fetch all model names
  const modelNames = await fetchModelNames();

  // Fetch tags for each model (with concurrency limit to be nice to the server)
  const CONCURRENCY = 5;
  const models = {};

  for (let i = 0; i < modelNames.length; i += CONCURRENCY) {
    const batch = modelNames.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (name) => {
        const tags = await fetchModelTags(name);
        return { name, tags };
      })
    );

    for (const { name, tags } of results) {
      models[name] = tags;
      console.log(`  ${name}: ${tags.length} tags`);
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
