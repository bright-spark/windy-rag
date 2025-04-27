import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getPineconeIndex } from '@/lib/pinecone';
import { generateNvidiaEmbeddings } from '@/lib/ai/nvidia';
import pdf from 'pdf-parse'; // Requires @types/pdf-parse installed

// Basic text chunking function (can be refined)
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 100): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    start += chunkSize - overlap;
    if (start >= text.length) break; // Prevent infinite loop on short texts
    // Ensure next chunk starts after the previous overlap
    start = Math.max(start, 0); 
  }
  return chunks;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const pineconeIndexName = process.env.PINECONE_INDEX_NAME;

  if (!pineconeIndexName) {
    return NextResponse.json({ error: 'Pinecone index name not configured' }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 1. Create Document Record (Status: PENDING)
    const document = await prisma.document.create({
      data: {
        userId,
        filename: file.name,
        mimetype: file.type,
        size: file.size,
        status: 'PENDING',
      },
    });

    try {
      // Update status to INDEXING
      await prisma.document.update({
        where: { id: document.id },
        data: { status: 'INDEXING' },
      });

      // 2. Parse File Content (PDF example)
      let textContent = '';
      if (file.type === 'application/pdf') {
        const fileBuffer = await file.arrayBuffer();
        const data = await pdf(Buffer.from(fileBuffer));
        textContent = data.text;
      } else {
        // TODO: Handle other file types (e.g., .txt, .md, .docx)
        textContent = await file.text(); // Basic text handling
      }

      if (!textContent.trim()) {
         throw new Error('Empty document content');
      }

      // 3. Chunk Text
      const chunks = chunkText(textContent);
      if (chunks.length === 0) {
          throw new Error('Could not generate chunks from document');
      }

      // 4. Generate Embeddings
      const embeddings = await generateNvidiaEmbeddings(chunks);
      if (embeddings.length !== chunks.length) {
        throw new Error('Mismatch between number of chunks and embeddings');
      }

      // 5. Prepare Vectors for Pinecone
      const vectors = chunks.map((chunk, index) => ({
        id: `${document.id}-chunk-${index}`,
        values: embeddings[index],
        metadata: {
          documentId: document.id,
          userId: userId,
          filename: file.name,
          text: chunk, // Store the chunk text itself in metadata
          chunkIndex: index,
        },
      }));

      // 6. Upsert to Pinecone
      const pineconeIndex = await getPineconeIndex(pineconeIndexName);
      // Consider upserting in batches for large documents
      await pineconeIndex.upsert(vectors);

      // 7. Update Document Status to INDEXED
      const updatedDocument = await prisma.document.update({
        where: { id: document.id },
        data: { status: 'INDEXED', pineconeId: document.id }, // Use doc ID as Pinecone grouping ID
      });

      return NextResponse.json({ success: true, document: updatedDocument });

    } catch (indexError: any) {
      console.error(`Failed to index document ${document.id}:`, indexError);
      // Update status to FAILED
      await prisma.document.update({
        where: { id: document.id },
        data: { status: 'FAILED' },
      });
      return NextResponse.json({ error: `Indexing failed: ${indexError.message}` }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Error processing document upload:', error);
    return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 });
  }
}
