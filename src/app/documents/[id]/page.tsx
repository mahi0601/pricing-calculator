'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/apiClient';
import type { DocumentApi } from '@/lib/types';

type DiscountType = 'none' | 'fixed' | 'percent';

const emptyLineForm = {
  description: '',
  quantity: '1',
  unitPrice: '',
  discountType: 'none' as DiscountType,
  discountValue: '',
  taxPercent: '',
};

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [doc, setDoc] = useState<DocumentApi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState('');
  const [customer, setCustomer] = useState('');
  const [issueDate, setIssueDate] = useState('');

  const [lineForm, setLineForm] = useState(emptyLineForm);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DocumentApi>(`/api/documents/${id}`)
      .then((d) => {
        setDoc(d);
        setTitle(d.title);
        setCustomer(d.customer);
        setIssueDate(d.issueDate.slice(0, 10));
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
          return;
        }
        setError(err instanceof ApiError ? err.message : 'Failed to load document');
      });
  }, [id, router]);

  const isDraft = doc?.status === 'draft';

  async function handleSaveMetadata(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const updated = await api.patch<DocumentApi>(`/api/documents/${id}`, { title, customer, issueDate });
      setDoc(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  function startEditLine(line: DocumentApi['lineItems'][number]) {
    setEditingLineId(line.id);
    setLineForm({
      description: line.description,
      quantity: String(line.quantity),
      unitPrice: String(line.unitPrice),
      discountType: line.discount?.type ?? 'none',
      discountValue: line.discount ? String(line.discount.value) : '',
      taxPercent: String(line.taxPercent),
    });
  }

  function resetLineForm() {
    setEditingLineId(null);
    setLineForm(emptyLineForm);
  }

  async function handleLineSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const payload = {
      description: lineForm.description,
      quantity: Number(lineForm.quantity),
      unitPrice: Number(lineForm.unitPrice),
      discount:
        lineForm.discountType === 'none'
          ? null
          : { type: lineForm.discountType, value: Number(lineForm.discountValue || 0) },
      taxPercent: Number(lineForm.taxPercent || 0),
    };
    try {
      const updated = editingLineId
        ? await api.patch<DocumentApi>(`/api/documents/${id}/lines/${editingLineId}`, payload)
        : await api.post<DocumentApi>(`/api/documents/${id}/lines`, payload);
      setDoc(updated);
      resetLineForm();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save line item');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteLine(lineId: string) {
    setError(null);
    setBusy(true);
    try {
      const updated = await api.delete<DocumentApi>(`/api/documents/${id}/lines/${lineId}`);
      setDoc(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete line item');
    } finally {
      setBusy(false);
    }
  }

  async function handleFinalize() {
    if (!confirm('Finalize this document? It will become read-only.')) return;
    setError(null);
    setBusy(true);
    try {
      const updated = await api.post<DocumentApi>(`/api/documents/${id}/finalize`);
      setDoc(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to finalize');
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicate() {
    setError(null);
    setBusy(true);
    try {
      const copy = await api.post<DocumentApi>(`/api/documents/${id}/duplicate`);
      router.push(`/documents/${copy.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to duplicate');
      setBusy(false);
    }
  }

  if (!doc) {
    return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;
  }

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ marginBottom: 0 }}>{doc.title}</h1>
        <span className={`badge ${doc.status}`}>{doc.status}</span>
      </div>

      <div className="card">
        <form className="inline" onSubmit={handleSaveMetadata}>
          <label>
            Title
            <input required disabled={!isDraft} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Customer
            <input required disabled={!isDraft} value={customer} onChange={(e) => setCustomer(e.target.value)} />
          </label>
          <label>
            Issue date
            <input type="date" required disabled={!isDraft} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </label>
          {isDraft && (
            <button type="submit" disabled={busy}>
              Save
            </button>
          )}
        </form>
      </div>

      {error && <p className="error">{error}</p>}

      <h2>Line items</h2>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit price</th>
            <th>Discount</th>
            <th>Tax %</th>
            <th>Line total</th>
            {isDraft && <th></th>}
          </tr>
        </thead>
        <tbody>
          {doc.lineItems.map((line) => (
            <tr key={line.id}>
              <td>{line.description}</td>
              <td>{line.quantity}</td>
              <td>${line.unitPrice.toFixed(2)}</td>
              <td>{line.discount ? (line.discount.type === 'fixed' ? `$${line.discount.value.toFixed(2)}` : `${line.discount.value}%`) : '—'}</td>
              <td>{line.taxPercent}%</td>
              <td>${line.lineTotal.toFixed(2)}</td>
              {isDraft && (
                <td className="row">
                  <button className="secondary" onClick={() => startEditLine(line)} disabled={busy}>
                    Edit
                  </button>
                  <button className="danger" onClick={() => handleDeleteLine(line.id)} disabled={busy}>
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}
          {doc.lineItems.length === 0 && (
            <tr>
              <td colSpan={isDraft ? 7 : 6} className="muted">
                No line items yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {isDraft && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>{editingLineId ? 'Edit line item' : 'Add line item'}</h2>
          <form className="inline" onSubmit={handleLineSubmit}>
            <label>
              Description
              <input required value={lineForm.description} onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })} />
            </label>
            <label>
              Quantity
              <input type="number" min="1" step="any" required value={lineForm.quantity} onChange={(e) => setLineForm({ ...lineForm, quantity: e.target.value })} />
            </label>
            <label>
              Unit price
              <input type="number" min="0" step="0.01" required value={lineForm.unitPrice} onChange={(e) => setLineForm({ ...lineForm, unitPrice: e.target.value })} />
            </label>
            <label>
              Discount
              <select value={lineForm.discountType} onChange={(e) => setLineForm({ ...lineForm, discountType: e.target.value as DiscountType })}>
                <option value="none">None</option>
                <option value="fixed">Fixed amount</option>
                <option value="percent">Percent</option>
              </select>
            </label>
            {lineForm.discountType !== 'none' && (
              <label>
                {lineForm.discountType === 'fixed' ? 'Amount' : 'Percent'}
                <input type="number" min="0" step="0.01" value={lineForm.discountValue} onChange={(e) => setLineForm({ ...lineForm, discountValue: e.target.value })} />
              </label>
            )}
            <label>
              Tax %
              <input type="number" min="0" step="0.01" value={lineForm.taxPercent} onChange={(e) => setLineForm({ ...lineForm, taxPercent: e.target.value })} />
            </label>
            <button type="submit" disabled={busy}>
              {editingLineId ? 'Save changes' : 'Add line'}
            </button>
            {editingLineId && (
              <button type="button" className="secondary" onClick={resetLineForm} disabled={busy}>
                Cancel
              </button>
            )}
          </form>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Totals</h2>
        <p>Subtotal: ${doc.totals.subtotal.toFixed(2)}</p>
        <p>Total discount: ${doc.totals.totalDiscount.toFixed(2)}</p>
        <p>Total tax: ${doc.totals.totalTax.toFixed(2)}</p>
        <p>
          <strong>Grand total: ${doc.totals.grandTotal.toFixed(2)}</strong>
        </p>
      </div>

      <div className="row">
        {isDraft && (
          <button onClick={handleFinalize} disabled={busy}>
            Finalize
          </button>
        )}
        {doc.status === 'finalized' && (
          <button onClick={handleDuplicate} disabled={busy}>
            Duplicate into new draft
          </button>
        )}
      </div>
    </>
  );
}
