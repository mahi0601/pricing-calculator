import { pgTable, uuid, text, integer, doublePrecision, timestamp, date, pgEnum, index } from 'drizzle-orm/pg-core';

export const documentStatusEnum = pgEnum('document_status', ['draft', 'finalized']);
export const discountTypeEnum = pgEnum('discount_type', ['fixed', 'percent']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    customer: text('customer').notNull(),
    issueDate: date('issue_date', { mode: 'date' }).notNull(),
    status: documentStatusEnum('status').notNull().default('draft'),
    subtotalCents: integer('subtotal_cents').notNull().default(0),
    totalDiscountCents: integer('total_discount_cents').notNull().default(0),
    totalTaxCents: integer('total_tax_cents').notNull().default(0),
    grandTotalCents: integer('grand_total_cents').notNull().default(0),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The summary report is always a per-user date-range scan; this index covers it directly.
    index('documents_user_issue_date_idx').on(table.userId, table.issueDate),
    index('documents_user_status_idx').on(table.userId, table.status),
  ]
);

export const lineItems = pgTable(
  'line_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    // Postgres rows carry no inherent order (unlike the embedded arrays this
    // replaced) — position preserves the order lines were added in.
    position: integer('position').notNull().default(0),
    description: text('description').notNull(),
    quantity: doublePrecision('quantity').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    discountType: discountTypeEnum('discount_type'),
    discountValue: doublePrecision('discount_value'),
    taxPercent: doublePrecision('tax_percent').notNull().default(0),
    subtotalCents: integer('subtotal_cents').notNull(),
    discountAmountCents: integer('discount_amount_cents').notNull(),
    afterDiscountCents: integer('after_discount_cents').notNull(),
    taxAmountCents: integer('tax_amount_cents').notNull(),
    lineTotalCents: integer('line_total_cents').notNull(),
  },
  (table) => [index('line_items_document_id_idx').on(table.documentId)]
);

export type UserRow = typeof users.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type LineItemRow = typeof lineItems.$inferSelect;
export type NewLineItemRow = typeof lineItems.$inferInsert;
