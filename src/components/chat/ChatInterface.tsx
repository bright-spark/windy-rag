'use client';

import { useChat, type Message } from 'ai/react'; // Use the react hook
import { useState, useRef, useEffect, useCallback } from 'react'; // Added useCallback
import { useDropzone } from 'react-dropzone'; // Added useDropzone
import { cn } from '@/lib/utils'; // Helper for conditional classNames (we'll create this)
import { SendHorizonal, UploadCloud, XCircle } from 'lucide-react'; // Added icons

// Explicitly list all known roles + default
type MessageRoleStyles = {
  [key in 'system' | 'user' | 'assistant' | 'function' | 'tool' | 'data' | 'default']: string;
};

// Basic styling for chat messages
const messageStyles: MessageRoleStyles = {
  system: 'text-xs text-center text-stone-500 py-2 w-full', // Added w-full for centering
  user: 'bg-orange-200 text-orange-950 rounded-lg px-4 py-2 max-w-[80%] self-end',
  assistant: 'bg-stone-700 text-stone-100 rounded-lg px-4 py-2 max-w-[80%] self-start',
  function: 'text-xs bg-purple-950 text-purple-300 rounded p-2 my-2 w-full', // Added style for function
  tool: 'text-xs bg-blue-950 text-blue-300 rounded p-2 my-2 w-full', // Added style for tool
  data: 'text-xs bg-gray-700 text-gray-300 rounded p-2 my-2 w-full', // Added style for data
  default: 'bg-gray-700 text-gray-100 rounded-lg px-4 py-2 max-w-[80%] self-start',
};

export function ChatInterface() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    // The API endpoint created earlier
    api: '/api/chat',
    // Optional: include initial messages or other config
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // --- File Upload Logic ---
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setUploading(true);
    setUploadError(null);
    setUploadedFiles(acceptedFiles); // Keep track of files being uploaded

    const file = acceptedFiles[0]; // Handle one file at a time for now
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      console.log('Upload successful:', result);
      // Optionally show success message or clear files
      setUploadedFiles([]); 

    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'An unknown error occurred during upload.');
      // Keep files in state so user can see what failed
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { // Define acceptable file types
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      // Add more types as needed (e.g., docx, csv)
    },
    multiple: false, // Allow only one file upload at a time
  });
  // --- End File Upload Logic ---

  return (
    <div className="flex flex-col h-full max-h-screen">
      {/* Message display area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#201713]">
        {messages.length > 0 ? (
          messages.map((m: Message) => (
            <div key={m.id} className={cn(
                'flex w-full',
                m.role === 'user' ? 'justify-end' : 'justify-start',
                // Ensure system, tool, function messages span width if needed
                ['system', 'tool', 'function', 'data'].includes(m.role) ? 'justify-center' : ''
            )}>
                <div className={cn(
                    'whitespace-pre-wrap break-words',
                    // Use explicit role or fallback to default (casting should be safe now)
                    messageStyles[m.role as keyof MessageRoleStyles] ?? messageStyles.default
                )}>
                {/* Render structured data if present */}
                {m.role === 'data' && m.data ? (
                    <pre className="text-xs">{JSON.stringify(m.data, null, 2)}</pre>
                ) : (
                    m.content
                )}
                </div>
            </div>
          ))
        ) : (
          <div className="flex justify-center items-center h-full">
            <p className="text-stone-500">Start chatting by typing below...</p>
          </div>
        )}
        {/* Anchor for scrolling */}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="border-t border-stone-700 p-4 text-red-500 text-sm">
          <p>Error: {error.message}</p>
        </div>
      )}

      {/* Input form */}
      <div className="border-t border-stone-700 p-4 bg-stone-800">
        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
          <input
            className="flex-1 p-2 rounded-md border border-stone-600 bg-stone-700 text-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
            value={input}
            placeholder="Send a message... (Attach files soon!)"
            onChange={handleInputChange}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-2 rounded-md bg-orange-600 hover:bg-orange-700 text-white disabled:bg-stone-600 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            <SendHorizonal size={20} />
          </button>
        </form>

        {/* --- File Upload Dropzone --- */}
        <div className="mt-4">
          <div
            {...getRootProps()}
            className={cn(
              'flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors',
              isDragActive ? 'border-orange-500 bg-stone-700/50' : 'border-stone-600 hover:border-orange-400 hover:bg-stone-700/30',
              uploading ? 'cursor-not-allowed opacity-60' : ''
            )}
          >
            <input {...getInputProps()} disabled={uploading} />
            <UploadCloud className="w-8 h-8 text-stone-500 mb-2" />
            {isDragActive ? (
              <p className="text-orange-400">Drop the file here ...</p>
            ) : (
              <p className="text-stone-400 text-center text-sm">
                Drag & drop a document (PDF, TXT, MD) here, or click to select
              </p>
            )}
          </div>

          {/* Display file being uploaded or upload error */} 
          {(uploadedFiles.length > 0 || uploadError) && (
            <div className="mt-2 text-sm flex items-center justify-between p-2 rounded bg-stone-700">
                {uploadedFiles.length > 0 && !uploadError && (
                    <span className="text-orange-200">Uploading: {uploadedFiles[0].name}</span>
                )}
                {uploadError && (
                    <span className="text-red-400">Error: {uploadError}</span>
                )}
                {/* Button to clear the current file/error display */}
                <button 
                    onClick={() => { setUploadedFiles([]); setUploadError(null); }}
                    className="text-stone-400 hover:text-red-500 ml-2"
                    aria-label="Clear upload status"
                >
                    <XCircle size={16} />
                </button>
            </div>
          )}

          {uploading && (
            <div className="mt-2 text-sm text-blue-400">Processing document...</div>
          )}
        </div>
        {/* --- End File Upload Dropzone --- */}
      </div>
    </div>
  );
}
