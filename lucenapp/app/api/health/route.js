import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET() {
  const root = process.cwd();
  const pub = path.join(root, 'public');

  const filesToCheck = ['manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png', 'og.png'];
  const files = Object.fromEntries(filesToCheck.map(f => [f, fs.existsSync(path.join(pub, f))]));

  // Manifest sanity
  let manifestOk = false;
  try {
    const text = fs.readFileSync(path.join(pub, 'manifest.webmanifest'), 'utf8');
    const m = JSON.parse(text);
    const sizes = (m.icons || []).map(i => String(i.sizes));
    manifestOk = sizes.some(s => s.includes('192')) && sizes.some(s => s.includes('512'));
  } catch {}

  // Tailwind v4 PostCSS plugin present?
  let postcssHasTailwind = false;
  try {
    const cands = ['postcss.config.js', 'postcss.config.mjs'].map(f => path.join(root, f));
    const p = cands.find(f => fs.existsSync(f));
    if (p) postcssHasTailwind = fs.readFileSync(p, 'utf8').includes('@tailwindcss/postcss');
  } catch {}

  // generateMetadata awaits headers()?
  let awaitedHeaders = 'unknown';
  try {
    const layout = fs.readFileSync(path.join(root, 'app', 'layout.jsx'), 'utf8');
    if (layout.includes('export async function generateMetadata')) {
      awaitedHeaders = layout.includes('await headers(') ? 'ok' : 'missing-await';
    } else {
      awaitedHeaders = 'no-fn';
    }
  } catch {}

  // Supabase anon read (uses a public-readable table; change if needed)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  let supabaseOk = false, supabaseError = null;
  try {
    if (url && key) {
      const supa = createClient(url, key);
      // Prefer a table with public SELECT (e.g., plans or ebooks)
      const { error } = await supa.from('plans').select('*', { head: true, count: 'exact' });
      supabaseOk = !error;
      if (error) supabaseError = error.message;
    } else {
      supabaseError = 'Missing env';
    }
  } catch (e) {
    supabaseError = String(e?.message || e);
  }

  const envs = {
    NEXT_PUBLIC_SUPABASE_URL: !!url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!key,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  return NextResponse.json({
    envs,
    files,
    manifestOk,
    postcssHasTailwind,
    awaitedHeaders,
    supabase: { ok: supabaseOk, error: supabaseError },
    time: new Date().toISOString(),
  });
}
