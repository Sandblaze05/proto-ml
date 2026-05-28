/**
 * POST /api/graph/restore — Restore a pipeline to a specific commit
 */

import { createClient } from '@/lib/supabase/server';
import { restoreCommit } from '@/lib/versioning/commitService';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { pipelineId, commitId, branchName = 'main' } = body;

    if (!pipelineId || !commitId) {
      return NextResponse.json(
        { ok: false, error: 'Missing pipelineId or commitId' },
        { status: 400 },
      );
    }

    const result = await restoreCommit(supabase, {
      pipelineId,
      commitId,
      branchName,
      authorId: user.id,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
