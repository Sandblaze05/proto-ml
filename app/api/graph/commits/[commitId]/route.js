/**
 * GET /api/graph/commits/[commitId] — Fetch a single commit (full payload)
 */

import { createClient } from '@/lib/supabase/server';
import { getCommit } from '@/lib/versioning/commitService';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { commitId } = await params;
    if (!commitId) {
      return NextResponse.json({ ok: false, error: 'Missing commitId' }, { status: 400 });
    }

    const result = await getCommit(supabase, commitId);
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
