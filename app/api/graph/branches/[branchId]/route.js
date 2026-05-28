/**
 * PUT    /api/graph/branches/[branchId] — Update branch metadata
 * DELETE /api/graph/branches/[branchId] — Archive a branch
 */

import { createClient } from '@/lib/supabase/server';
import { updateBranch } from '@/lib/versioning/branchService';
import { NextResponse } from 'next/server';

export async function PUT(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { branchId } = await params;
    if (!branchId) {
      return NextResponse.json({ ok: false, error: 'Missing branchId' }, { status: 400 });
    }

    const body = await request.json();
    const result = await updateBranch(supabase, branchId, body);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { branchId } = await params;
    if (!branchId) {
      return NextResponse.json({ ok: false, error: 'Missing branchId' }, { status: 400 });
    }

    // Fetch branch to get pipeline_id and name
    const { data: branch } = await supabase
      .from('pipeline_branches')
      .select('pipeline_id, name')
      .eq('id', branchId)
      .single();

    if (!branch) {
      return NextResponse.json({ ok: false, error: 'Branch not found' }, { status: 404 });
    }

    const { archiveBranch } = await import('@/lib/versioning/branchService');
    const result = await archiveBranch(supabase, branch.pipeline_id, branch.name);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
