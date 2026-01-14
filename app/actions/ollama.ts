'use server';

import ollama from 'ollama';

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export async function getInstalledModels(): Promise<OllamaModel[]> {
  try {
    const response = await ollama.list();
    return response.models as OllamaModel[];
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
}

export async function pullModel(modelName: string): Promise<{ success: boolean; message: string }> {
  try {
    // This awaits the full pull. For large models, this might timeout the server action.
    // Ideally we would stream this, but for now we'll try a simple await.
    // Next.js Server Actions have a default timeout.
    await ollama.pull({ model: modelName });
    return { success: true, message: `Successfully pulled ${modelName}` };
  } catch (error: any) {
    console.error('Error pulling model:', error);
    return { success: false, message: error.message || 'Failed to pull model' };
  }
}

export async function deleteModel(
  modelName: string
): Promise<{ success: boolean; message: string }> {
  try {
    await ollama.delete({ model: modelName });
    return { success: true, message: `Successfully deleted ${modelName}` };
  } catch (error: any) {
    console.error('Error deleting model:', error);
    return { success: false, message: error.message || 'Failed to delete model' };
  }
}
