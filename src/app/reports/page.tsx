'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/apiClient';
import type { SummaryReportApi } from '@/lib/types';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [from, setFrom] = useState(firstOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const [status, setStatus] = useState<'' | 'draft' | 'finalized'>('');
  const [report, setReport] = useState<SummaryReportApi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const qs = new URLSearchParams({ from, to, ...(status ? { status } : {}) });
      const res = await api.get<SummaryReportApi>(`/api/reports/summary?${qs.toString()}`);
      setReport(res);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace('/login');
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1>Summary report</h1>
      <form className="inline" onSubmit={handleSubmit}>
        <label>
          From
          <input type="date" required value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" required value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="finalized">Finalized</option>
          </select>
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Loading…' : 'Run report'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {report && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <p className="muted">
            {report.from.slice(0, 10)} – {report.to.slice(0, 10)}
          </p>
          <p>Documents: {report.documentCount}</p>
          <p>Total discount: ${report.totalDiscount.toFixed(2)}</p>
          <p>Total tax: ${report.totalTax.toFixed(2)}</p>
          <p>
            <strong>Grand total: ${report.grandTotal.toFixed(2)}</strong>
          </p>
        </div>
      )}
    </>
  );
}
