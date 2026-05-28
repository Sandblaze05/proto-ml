/**
 * POST /api/graph/commits — Create a new commit
 * GET  /api/graph/commits — List commits (paginated)
 */

import { createClient } from '@/lib/supabase/server';
import { createCommit, listCommits } from '@/lib/versioning/commitService';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      pipelineId,
      branchName = 'main',
      nodes = [],
      edges = [],
      drawings = [],
      message = '',
      tag = null,
      executionMeta = {},
    } = body;

    if (!pipelineId) {
      return NextResponse.json({ ok: false, error: 'Missing pipelineId' }, { status: 400 });
    }

    const result = await createCommit(supabase, {
      pipelineId,
      branchName,
      nodes,
      edges,
      drawings,
      message,
      tag,
      authorId: user.id,
      executionMeta,
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
    const branchName = searchParams.get('branch') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const cursor = searchParams.get('cursor')
      ? parseInt(searchParams.get('cursor'), 10)
      : undefined;

    if (!pipelineId) {
      return NextResponse.json({ ok: false, error: 'Missing pipelineId' }, { status: 400 });
    }

    const result = await listCommits(supabase, {
      pipelineId,
      branchName,
      limit,
      cursor,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
