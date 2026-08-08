'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from './apiClient';

export interface Session {
  id: string;
  email: string;
}

/** Client-side session lookup. `status` is 'loading' until the /me check resolves. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => {
    let cancelled = false;
    api
      .get<Session>('/api/auth/me')
      .then((s) => {
        if (!cancelled) {
          setSession(s);
          setStatus('authenticated');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setStatus('unauthenticated');
        } else {
          setStatus('unauthenticated');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { session, status };
}
