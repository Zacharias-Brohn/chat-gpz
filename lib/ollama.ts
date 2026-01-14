import { Ollama } from 'ollama';

// Singleton holder
let ollamaInstance: Ollama | null = null;

function getOllamaInstance(): Ollama {
  if (!ollamaInstance) {
    // DEBUGGING: Log the environment variable explicitly on first use
    const envHost = process.env.OLLAMA_HOST;
    console.log('----------------------------------------');
    console.log('[lib/ollama.ts] Initializing Ollama instance (Lazy)');
    console.log(`[lib/ollama.ts] process.env.OLLAMA_HOST: '${envHost}'`);
    console.log(`[lib/ollama.ts] NODE_ENV: '${process.env.NODE_ENV}'`);
    console.log('----------------------------------------');

    // Initialize Ollama with the host from environment variables
    // defaulting to localhost if not specified.
    const host = envHost || 'http://127.0.0.1:11434';

    if (!envHost) {
      console.warn(
        '[lib/ollama.ts] WARNING: OLLAMA_HOST is not set. Defaulting to 127.0.0.1:11434. If your Ollama instance is on another machine, this will fail.'
      );
    }

    console.log(`[lib/ollama.ts] Final Host used for Ollama: ${host}`);
    ollamaInstance = new Ollama({ host });
  }
  return ollamaInstance;
}

// Proxy to ensure we initialize lazily when any property is accessed
const ollamaProxy = new Proxy({} as Ollama, {
  get(_target, prop) {
    const instance = getOllamaInstance();
    // @ts-ignore
    const value = instance[prop];

    // Bind functions to the instance to ensure 'this' context is correct
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});

export default ollamaProxy;
