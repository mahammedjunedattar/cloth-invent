// components/AuthGuard.jsx
'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AuthGuard({ children }) {
  const { status } = useSession();
  const router = useRouter();

  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  return children;
}

// Usage in layout
