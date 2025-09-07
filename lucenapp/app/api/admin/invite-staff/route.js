// app/api/admin/invite-staff/route.js
import { NextResponse } from 'next/server';
import { getUserAndProfile } from '../../../lib/supabaseServerClient'; 
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  const { user, profile } = await getUserAndProfile();
  if (!user || profile?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'email_required' }, { status: 400 });

  const supaAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // send invite email
  const { data, error } = await supaAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/staff`,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // mark invited user as staff once they exist (id present after invite)
  if (data?.user?.id) {
    await supaAdmin.from('profiles').upsert({ id: data.user.id, email, role: 'staff' }, { onConflict: 'id' });
  }

  return NextResponse.json({ ok: true });
}
