'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button'; // Assuming you have a Button component, adjust if needed

export function AuthButton() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    // Optionally return a loading state or null
    return <div className="w-[100px] h-[36px] bg-stone-700 rounded animate-pulse"></div>;
  }

  if (session) {
    return (
      <Button
        variant="destructive" // Use appropriate variant
        size="sm"
        onClick={() => signOut()}
        aria-label="Sign out"
        className="flex items-center gap-2"
      >
        <LogOut size={16} />
        <span>Sign Out</span>
        {/* Optionally display email: <span className="text-xs">({session.user?.email})</span> */}
      </Button>
    );
  }

  return (
    <Button
      variant="default" // Use appropriate variant (e.g., primary/orange)
      size="sm"
      onClick={() => signIn('email')}
      aria-label="Sign in with Email"
      className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
    >
      <LogIn size={16} />
      <span>Sign In</span>
    </Button>
  );
}
