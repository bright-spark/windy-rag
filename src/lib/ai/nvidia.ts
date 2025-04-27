import { 
  createAI, 
  createProvider, 
  openai, 
  GenerateTextParams, 
  GenerateEmbeddingsParams, 
  CoreTool 
} from 'ai';
import { z } from 'zod';

// Ensure NVIDIA API key is set
if (!process.env.NVIDIA_API_KEY) {
  throw new Error('Missing NVIDIA_API_KEY environment variable');
}

const NVIDIA_API_BASE_URL = 'https://integrate.api.nvidia.com/v1';

// Define the structure for NVIDIA API calls using a custom provider
const nvidiaProvider = createProvider({
  // Provider ID can be anything, used for identification
  providerId: 'nvidia',
  // Define the generateText function
  generateText: async ({ model, prompt, messages, tools, toolChoice, ...options }: GenerateTextParams) => {
    const chatModel = model || process.env.NVIDIA_CHAT_MODEL;
    if (!chatModel) {
      throw new Error('NVIDIA chat model name not configured');
    }

    const url = `${NVIDIA_API_BASE_URL}/chat/completions`;
    const headers = {
      'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream', // For streaming
    };

    // Combine prompt and messages if necessary (NVIDIA might expect 'messages' format)
    const requestMessages = messages ?? (
      prompt ? [{ role: 'user', content: prompt }] : []
    );

    const payload: Record<string, any> = {
      model: chatModel,
      messages: requestMessages,
      stream: true, // Use streaming for chat
      // Include tool parameters if tools are provided
      ...(tools && { 
        tools: tools.map((tool: CoreTool) => ({ 
          type: 'function', 
          // Assuming NVIDIA expects a structure similar to OpenAI tools
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          }
        })) 
      }),
      ...(toolChoice && { tool_choice: toolChoice }),
      // Add other potential options like temperature, max_tokens if supported/needed
      // temperature: options.temperature,
      // max_tokens: options.maxTokens,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`NVIDIA API Error (${response.status}): ${errorBody}`);
    }

    // Return the response stream directly for the Vercel AI SDK to handle
    // The SDK expects an OpenAI-compatible stream format
    // TODO: Verify NVIDIA's SSE format matches OpenAI's or adapt if necessary
    return openai.stream({ response });
  },

  // Define the generateEmbeddings function
  generateEmbeddings: async ({ model, texts }: GenerateEmbeddingsParams) => {
    const embeddingModel = model || process.env.NVIDIA_EMBEDDING_MODEL;
    if (!embeddingModel) {
      throw new Error('NVIDIA embedding model name not configured');
    }

    const url = `${NVIDIA_API_BASE_URL}/embeddings`;
    const headers = {
      'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
      'Content-Type': 'application/json',
    };

    const payload = {
      input: texts,
      model: embeddingModel,
      // NVIDIA might use a different key, e.g., 'input_type' or 'encoding_format'
      // input_type: 'query', // or 'document' depending on use case if required
      // encoding_format: 'float', // if needed
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`NVIDIA API Error (${response.status}): ${errorBody}`);
    }

    const json = await response.json();

    // Assuming response format is similar to OpenAI:
    // { data: [ { embedding: [ ... ], index: 0 }, ... ], usage: { ... } }
    const embeddings = json.data.map((item: any) => item.embedding);
    const usage = { promptTokens: json.usage?.prompt_tokens ?? 0, totalTokens: json.usage?.total_tokens ?? 0 };

    return { embeddings, usage };
  },
});

// Create the AI instance configured with the NVIDIA provider
export const nvidia = createAI({
  providers: { nvidia: nvidiaProvider },
  // Example tool definition using Zod schema (if needed later)
  tools: {
    exampleTool: {
      description: 'An example tool description.',
      parameters: z.object({
        value: z.string().describe('The value to use.'),
      }),
      execute: async ({ value }: { value: string }) => {
        // Tool execution logic here
        console.log(`Example tool called with value: ${value}`);
        return { result: `Processed value: ${value}` };
      },
    },
  }
});

// Helper function to explicitly use the NVIDIA embedding model
export async function generateNvidiaEmbeddings(texts: string[]): Promise<number[][]> {
  const { embeddings } = await nvidia.nvidia.generateEmbeddings({
    model: process.env.NVIDIA_EMBEDDING_MODEL ?? undefined, // Ensure model can be undefined
    texts,
  });
  return embeddings;
}

// Export the provider directly if needed elsewhere
export { nvidiaProvider };
