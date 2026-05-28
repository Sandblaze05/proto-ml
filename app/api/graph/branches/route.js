/**
 * POST /api/graph/branches — Create a new branch
 * GET  /api/graph/branches — List branches for a pipeline
 */

import { createClient } from '@/lib/supabase/server';
import { createBranch, listBranches } from '@/lib/versioning/branchService';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { pipelineId, name, fromCommitId, description = '' } = body;

    if (!pipelineId || !name) {
      return NextResponse.json(
        { ok: false, error: 'Missing pipelineId or branch name' },
        { status: 400 },
      );
    }

    const result = await createBranch(supabase, {
      pipelineId,
      name,
      fromCommitId,
      description,
      userId: user.id,
    });

    return NextResponse.json(result, { status: result.ok ? 201 : 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pipelineId = searchParams.get('pipelineId');
    const includeArchived = searchParams.get('includeArchived') === 'true';

    if (!pipelineId) {
      return NextResponse.json({ ok: false, error: 'Missing pipelineId' }, { status: 400 });
    }

    const result = await listBranches(supabase, pipelineId, { includeArchived });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
