'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/useSession';
import { api } from '@/lib/apiClient';

export function NavBar() {
  const { session, status } = useSession();
  const router = useRouter();

  async function handleLogout() {
    await api.post('/api/auth/logout');
    router.push('/login');
    router.refresh();
  }

  return (
    <nav className="navbar">
      <Link href="/documents">
        <strong>Pricing Calculator</strong>
      </Link>
      {status === 'authenticated' && (
        <>
          <Link href="/documents">Documents</Link>
          <Link href="/reports">Reports</Link>
        </>
      )}
      <span className="spacer" />
      {status === 'authenticated' && session && (
        <>
          <span className="muted">{session.email}</span>
          <button className="secondary" onClick={handleLogout}>
            Log out
          </button>
        </>
      )}
      {status === 'unauthenticated' && (
        <>
          <Link href="/login">Log in</Link>
          <Link href="/signup">Sign up</Link>
        </>
      )}
    </nav>
  );
}
