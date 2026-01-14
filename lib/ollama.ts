import { Ollama } from 'ollama';

// Initialize Ollama with the host from environment variables
// defaulting to localhost if not specified.
// This ensures that OLLAMA_HOST is respected.
const host = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';

console.log(`Initializing Ollama client with host: ${host}`);

const ollama = new Ollama({ host });

export default ollama;
