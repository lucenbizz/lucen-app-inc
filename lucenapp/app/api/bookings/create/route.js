import { z } from 'zod';
import { getUser } from '../../../lib/supabaseServerClient.js';
import { created, badRequest, unauthorized, serverError } from '../../../lib/http.js';
import { createClient } from '@supabase/supabase-js';
import { env } from '../../../lib/env.js';

const schema = z.object({
  slot_time: z.string().datetime(),
  notes: z.string().max(1000).optional(),
});

export async function POST(req) {
  try {
    const { user } = await getUser();
    if (!user) return unauthorized();

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest('invalid_payload');

    // Client key is fine here because RLS enforces ownership
    const supa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data, error } = await supa
      .from('bookings')
      .insert([{ slot_time: parsed.data.slot_time, notes: parsed.data.notes ?? null }])
      .select()
      .single();

    if (error) throw error;
    return created({ booking: data });
  } catch (e) {
    return serverError(e);
  }
}
