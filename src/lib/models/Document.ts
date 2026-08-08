import mongoose, { Schema, type Model } from 'mongoose';

export interface LineItemComputedFields {
  subtotalCents: number;
  discountAmountCents: number;
  afterDiscountCents: number;
  taxAmountCents: number;
  lineTotalCents: number;
}

export interface LineItemDoc extends LineItemComputedFields {
  _id: mongoose.Types.ObjectId;
  description: string;
  quantity: number;
  unitPriceCents: number;
  discountType: 'fixed' | 'percent' | null;
  discountValue: number | null;
  taxPercent: number;
}

export interface DocumentTotalsFields {
  subtotalCents: number;
  totalDiscountCents: number;
  totalTaxCents: number;
  grandTotalCents: number;
}

export type DocumentStatus = 'draft' | 'finalized';

export interface DocumentDoc extends DocumentTotalsFields {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  customer: string;
  issueDate: Date;
  status: DocumentStatus;
  lineItems: LineItemDoc[];
  finalizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const LineItemSchema = new Schema<LineItemDoc>(
  {
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceCents: { type: Number, required: true, min: 0 },
    // Flattened rather than nested `discount: { type, value }`: Mongoose
    // reserves the key "type" for SchemaType definitions, so a subfield
    // literally named "type" gets misparsed as a type descriptor instead of
    // plain data. The API layer still exposes/accepts a nested `discount`
    // object; this flattening is purely a storage-layer detail.
    discountType: { type: String, enum: ['fixed', 'percent'], default: null },
    discountValue: { type: Number, default: null },
    taxPercent: { type: Number, required: true, default: 0, min: 0 },
    subtotalCents: { type: Number, required: true },
    discountAmountCents: { type: Number, required: true },
    afterDiscountCents: { type: Number, required: true },
    taxAmountCents: { type: Number, required: true },
    lineTotalCents: { type: Number, required: true },
  },
  { _id: true }
);

const DocumentSchema = new Schema<DocumentDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    customer: { type: String, required: true, trim: true },
    issueDate: { type: Date, required: true },
    status: { type: String, enum: ['draft', 'finalized'], required: true, default: 'draft' },
    lineItems: { type: [LineItemSchema], default: [] },
    subtotalCents: { type: Number, required: true, default: 0 },
    totalDiscountCents: { type: Number, required: true, default: 0 },
    totalTaxCents: { type: Number, required: true, default: 0 },
    grandTotalCents: { type: Number, required: true, default: 0 },
    finalizedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Summary report is filtered by issue date range, always scoped to the
// requesting user — this compound index covers that query directly.
DocumentSchema.index({ userId: 1, issueDate: 1 });
DocumentSchema.index({ userId: 1, status: 1 });

// Named PricingDocument (not "Document") to avoid shadowing the global DOM
// `Document` type that TypeScript's lib.dom.d.ts brings into scope.
export const PricingDocument: Model<DocumentDoc> =
  mongoose.models.PricingDocument || mongoose.model<DocumentDoc>('PricingDocument', DocumentSchema);
