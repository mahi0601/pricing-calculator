import mongoose from 'mongoose';
import { PricingDocument } from './models/Document';

/** Loads a document by id, scoped to the requesting user. Returns null on bad id, not-found, or wrong owner — callers should respond 404 in all three cases so existence isn't leaked across users. */
export async function loadOwnedDocument(userId: string, documentId: string) {
  if (!mongoose.isValidObjectId(documentId)) return null;
  return PricingDocument.findOne({ _id: documentId, userId });
}
