import Image from "next/image";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { AuthButton } from '@/components/auth/AuthButton';

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <main className="relative flex flex-col h-screen bg-stone-900 text-stone-100 p-4">
      <div className="absolute top-4 right-4 z-10">
        <AuthButton />
      </div>

      {session?.user ? (
        <ChatInterface />
      ) : (
        <div className="flex flex-col items-center justify-center h-full">
          <h1 className="text-2xl font-semibold mb-4">Welcome to Windy RAG</h1>
          <p className="text-stone-400 mb-6">Please sign in to start chatting.</p>
        </div>
      )}
    </main>
  );
}
