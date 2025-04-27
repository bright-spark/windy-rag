import { NextRequest, NextResponse } from 'next/server';
import { Message as VercelChatMessage, StreamingTextResponse } from 'ai';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getPineconeIndex } from '@/lib/pinecone';
import { nvidia, generateNvidiaEmbeddings } from '@/lib/ai/nvidia'; // Use the configured AI instance

// Function to format previous messages for the prompt
const formatMessage = (message: VercelChatMessage) => {
  return `${message.role}: ${message.content}`;
};

const RAG_PROMPT_TEMPLATE = `You are a helpful AI assistant. Use the following context retrieved from uploaded documents to answer the user's question. If the context doesn't contain the answer, state that you couldn't find the information in the provided documents.

Context:
---
{context}
---

Chat History:
---
{chatHistory}
---

User Question: {question}

Answer:`;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const pineconeIndexName = process.env.PINECONE_INDEX_NAME;
  const nvidiaChatModel = process.env.NVIDIA_CHAT_MODEL;

  if (!pineconeIndexName || !nvidiaChatModel) {
    return NextResponse.json({ error: 'Pinecone index or NVIDIA model not configured' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const messages: VercelChatMessage[] = body.messages ?? [];
    const currentMessageContent = messages[messages.length - 1]?.content;

    if (!currentMessageContent) {
      return NextResponse.json({ error: 'No message content found' }, { status: 400 });
    }

    // Store the user's message (optional: might store after successful AI response)
    // const chatId = body.chatId; // Assuming chatId is sent from the client
    // if (chatId) {
    //   await prisma.chatMessage.create({
    //     data: {
    //       chatSessionId: chatId,
    //       sender: 'USER',
    //       content: currentMessageContent,
    //     }
    //   });
    // }

    // 1. Generate embedding for the user's query
    const [queryEmbedding] = await generateNvidiaEmbeddings([currentMessageContent]);

    // 2. Query Pinecone for relevant context
    const pineconeIndex = await getPineconeIndex(pineconeIndexName);
    const queryResponse = await pineconeIndex.query({
      vector: queryEmbedding,
      topK: 5, // Retrieve top 5 relevant chunks
      filter: { userId: userId }, // Ensure user only sees their own docs
      includeMetadata: true,
    });

    const context = queryResponse.matches
      .map(match => match.metadata?.text)
      .filter(text => text)
      .join('\n\n');

    // 3. Format chat history
    const formattedPreviousMessages = messages.slice(0, -1).map(formatMessage).join('\n');

    // 4. Construct the prompt
    const prompt = RAG_PROMPT_TEMPLATE
      .replace('{context}', context || 'No relevant context found in documents.')
      .replace('{chatHistory}', formattedPreviousMessages || 'No previous messages.')
      .replace('{question}', currentMessageContent);

    // 5. Prepare messages array for NVIDIA API (using custom provider format)
    // We replace the original messages with our RAG-enhanced prompt structure.
    // The Vercel AI SDK expects the 'messages' format for its stream generation.
    const nvidiaMessages = [
        // Optional system prompt if needed by the model
        // { role: 'system', content: 'You are a helpful assistant...' }, 
        { role: 'user', content: prompt } 
    ];

    // 6. Call the NVIDIA model via the custom provider and stream the response
    const stream = await nvidia.nvidia.generateText({
      model: nvidiaChatModel,
      messages: nvidiaMessages, // Send the structured prompt as messages
      // Add parameters like temperature if desired
      // temperature: 0.7,
    });

    // Return the StreamingTextResponse
    // The Vercel AI SDK handles the SSE stream format.
    return new StreamingTextResponse(stream);

  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: `Chat failed: ${error.message}` }, { status: 500 });
  }
}
