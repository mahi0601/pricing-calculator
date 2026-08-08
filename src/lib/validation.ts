import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const discountSchema = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('fixed'), value: z.number().nonnegative('Fixed discount must be non-negative') }),
    z.object({
      type: z.literal('percent'),
      value: z.number().min(0, 'Discount percent must be at least 0').max(100, 'Discount percent must be at most 100'),
    }),
  ])
  .nullable()
  .optional();

export const lineItemInputSchema = z.object({
  description: z.string().trim().min(1, 'Description is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().nonnegative('Unit price must be non-negative'),
  discount: discountSchema,
  taxPercent: z.number().min(0, 'Tax percent must be non-negative').max(100, 'Tax percent must be at most 100').optional(),
});

export const lineItemUpdateSchema = lineItemInputSchema.partial();

export const documentCreateSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  customer: z.string().trim().min(1, 'Customer is required'),
  issueDate: z.coerce.date({ error: 'Invalid issue date' }),
  lineItems: z.array(lineItemInputSchema).optional().default([]),
});

export const documentUpdateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  customer: z.string().trim().min(1).optional(),
  issueDate: z.coerce.date({ error: 'Invalid issue date' }).optional(),
});

export const reportQuerySchema = z.object({
  from: z.coerce.date({ error: 'Invalid "from" date' }),
  to: z.coerce.date({ error: 'Invalid "to" date' }),
});
