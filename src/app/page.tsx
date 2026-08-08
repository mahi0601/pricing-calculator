'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/useSession';

export default function Home() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/documents');
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  return <p className="muted">Loading…</p>;
}
