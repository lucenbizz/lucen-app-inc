// lib/validate.js
import { z } from 'zod';

export const areaTag = z.string().min(1).max(64).regex(/^[a-z0-9-_.]+$/i);
export const isoTz = z.string().datetime(); // or custom

export const CreateIntentSchema = z.object({
  area_tag: areaTag,
  delivery_slot_at: isoTz,
  reservationId: z.string().optional(),
  cartTotalCents: z.number().int().nonnegative(),
});
 