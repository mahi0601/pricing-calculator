export type DiscountApi = { type: 'fixed' | 'percent'; value: number } | null;

export interface LineItemApi {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: DiscountApi;
  taxPercent: number;
  subtotal: number;
  discountAmount: number;
  afterDiscount: number;
  taxAmount: number;
  lineTotal: number;
}

export interface DocumentApi {
  id: string;
  title: string;
  customer: string;
  issueDate: string;
  status: 'draft' | 'finalized';
  finalizedAt: string | null;
  lineItems: LineItemApi[];
  totals: { subtotal: number; totalDiscount: number; totalTax: number; grandTotal: number };
  createdAt: string;
  updatedAt: string;
}

export type DocumentSummaryApi = Omit<DocumentApi, 'lineItems'>;

export interface DocumentListResponse {
  documents: DocumentSummaryApi[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SummaryReportApi {
  from: string;
  to: string;
  documentCount: number;
  grandTotal: number;
  totalTax: number;
  totalDiscount: number;
}
