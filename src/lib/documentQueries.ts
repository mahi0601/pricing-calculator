import { and, eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import type { DocumentRow, LineItemRow } from './schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

// Accepts both a top-level db handle and a transaction (`tx`) callback
// param, since PgTransaction extends PgDatabase — lets callers use the same
// helpers inside and outside db.transaction().
type DbOrTx = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;

/** Loads a document by id, scoped to the requesting user. Returns null on bad id, not-found, or wrong owner — callers should respond 404 in all three cases so existence isn't leaked across users. */
export async function loadOwnedDocument(db: DbOrTx, userId: string, documentId: string): Promise<DocumentRow | null> {
  if (!isValidUuid(documentId)) return null;
  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(and(eq(schema.documents.id, documentId), eq(schema.documents.userId, userId)));
  return doc ?? null;
}

export async function getLineItems(db: DbOrTx, documentId: string): Promise<LineItemRow[]> {
  const lines = await db.select().from(schema.lineItems).where(eq(schema.lineItems.documentId, documentId));
  return lines.sort((a, b) => a.position - b.position);
}

/** Recomputes and persists a document's cached totals from its current line items, bumping updated_at. Returns the updated document row. */
export async function persistTotals(
  db: DbOrTx,
  documentId: string,
  totals: { subtotalCents: number; totalDiscountCents: number; totalTaxCents: number; grandTotalCents: number }
): Promise<DocumentRow> {
  const [updated] = await db
    .update(schema.documents)
    .set({ ...totals, updatedAt: new Date() })
    .where(eq(schema.documents.id, documentId))
    .returning();
  return updated;
}
