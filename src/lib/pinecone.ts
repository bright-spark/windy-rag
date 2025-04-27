import { Pinecone } from '@pinecone-database/pinecone';

if (!process.env.PINECONE_API_KEY) {
  throw new Error('Missing Pinecone API key');
}

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

export const getPineconeClient = async () => {
  // In a real app, you might cache this client instance
  // or handle potential initialization errors more gracefully.
  return pinecone;
};

// Optional: Function to get a specific index, ensuring it exists
export const getPineconeIndex = async (indexName: string) => {
  if (!process.env.PINECONE_ENVIRONMENT) {
    throw new Error('Missing Pinecone environment');
  }
  const client = await getPineconeClient();
  // Check if index exists
  const indexes = await client.listIndexes();
  if (!indexes.indexes?.some(index => index.name === indexName)) {
    // Basic example: Create index if it doesn't exist.
    // Production apps might need more configuration (dimension, metric, pod type etc.)
    // We need the embedding dimension first. Let's assume 1024 for nv-embed-qa-4 for now.
    // TODO: Make dimension dynamic based on selected embedding model.
    console.log(`Creating index "${indexName}"...`);
    await client.createIndex({
      name: indexName,
      dimension: 1024, // Example dimension for nv-embed-qa-4
      metric: 'cosine', // Common metric for embeddings
      spec: {
        // Specify pod environment based on your Pinecone plan (e.g., serverless, pod)
        serverless: {
          cloud: 'aws', // Or 'gcp', 'azure'
          region: process.env.PINECONE_ENVIRONMENT // Use the environment variable for region
        }
        // If using pod-based index:
        // pod: {
        //   environment: process.env.PINECONE_ENVIRONMENT,
        //   podType: 'p1.x1' // Example pod type
        // }
      }
    });
    console.log(`Index "${indexName}" created.`);
    // Wait a moment for the index to be ready
    await new Promise(resolve => setTimeout(resolve, 5000)); // Adjust delay as needed
  }

  return client.index(indexName);
};
