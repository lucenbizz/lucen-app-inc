// app/api/billing/portal/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { headers, cookies } from 'next/headers';
import Stripe from 'stripe';
import { createServerClient } from '@supabase/ssr';

function baseUrlFromHeaders(h) {
  const proto = h.get('x-forwarded-proto') || 'https';
  const host = h.get('x-forwarded-host') || h.get('host');
  return `${proto}://${host}`;
}

export async function POST(req) {
  // Edge-safe Supabase server client (works in Node runtime too)
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) => cookieStore.set({ name, value, ...options }),
        remove: (name, options) => cookieStore.set({ name, value: '', ...options }),
      },
    }
  );

  // Auth required
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Load (or create) Stripe customer id from your profiles table
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  if (profErr) {
    return NextResponse.json({ error: profErr.message || 'profile_lookup_failed' }, { status: 400 });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    // Don’t throw at import/build time; return a clear runtime error
    return NextResponse.json({ error: 'Missing STRIPE_SECRET_KEY' }, { status: 500 });
  }

  // Initialize Stripe *inside* the handler using the secret
  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' });

  let customerId = profile?.stripe_customer_id;

  // If you don’t store the customer yet, try to find/create one
  if (!customerId) {
    const existing = await stripe.customers.list({ email: user.email, limit: 1 });
    if (existing.data[0]) {
      customerId = existing.data[0].id;
    } else {
      const created = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = created.id;
    }
    // Persist on your profile for next time (ignore errors)
    await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  const h = headers();
  const returnUrl = `${baseUrlFromHeaders(h)}/dashboard`;

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return NextResponse.json({ url: session.url });
}
