// app/api/me/route.js
import { NextResponse } from 'next/server';
import { getUserAndProfile } from '../../lib/supabaseServerClient.js';

export async function GET() {
  const { user, profile } = await getUserAndProfile();
  return NextResponse.json({ user, profile });
}
