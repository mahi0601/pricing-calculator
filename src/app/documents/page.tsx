'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/apiClient';
import type { DocumentApi, DocumentListResponse } from '@/lib/types';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentApi[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | 'draft' | 'finalized'>('');
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [customer, setCustomer] = useState('');
  const [issueDate, setIssueDate] = useState(todayIso());
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const qs = statusFilter ? `?status=${statusFilter}` : '';
    api
      .get<DocumentListResponse>(`/api/documents${qs}`)
      .then((res) => setDocuments(res.documents))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
          return;
        }
        setError(err instanceof ApiError ? err.message : 'Failed to load documents');
      });
  }, [statusFilter, router]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const doc = await api.post<DocumentApi>('/api/documents', { title, customer, issueDate, lineItems: [] });
      router.push(`/documents/${doc.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create document');
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <h1>Documents</h1>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>New document</h2>
        <form className="inline" onSubmit={handleCreate}>
          <label>
            Title
            <input required value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Customer
            <input required value={customer} onChange={(e) => setCustomer(e.target.value)} />
          </label>
          <label>
            Issue date
            <input type="date" required value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </label>
          <button type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Create draft'}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>

      <div className="row" style={{ marginBottom: '0.75rem' }}>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: '0.4rem' }}>
          Filter:
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="finalized">Finalized</option>
          </select>
        </label>
      </div>

      {documents === null ? (
        <p className="muted">Loading…</p>
      ) : documents.length === 0 ? (
        <p className="muted">No documents yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Customer</th>
              <th>Issue date</th>
              <th>Status</th>
              <th>Grand total</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id}>
                <td>
                  <Link href={`/documents/${doc.id}`}>{doc.title}</Link>
                </td>
                <td>{doc.customer}</td>
                <td>{doc.issueDate.slice(0, 10)}</td>
                <td>
                  <span className={`badge ${doc.status}`}>{doc.status}</span>
                </td>
                <td>${doc.totals.grandTotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
