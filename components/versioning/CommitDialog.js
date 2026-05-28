'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { X, GitCommit, Tag } from 'lucide-react';
import { useVersionStore } from '@/store/useVersionStore';
import { useUIStore } from '@/store/useUIStore';
import { computeGraphDiff } from '@/lib/versioning/graphDiff';

export default function CommitDialog() {
  const {
    commitDialogOpen,
    closeCommitDialog,
    headCommit,
    doCommit,
    activeBranch
  } = useVersionStore();

  const { nodes, edges, drawings, addToast } = useUIStore();

  const [message, setMessage] = useState('');
  const [tag, setTag] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when opening/closing
  useEffect(() => {
    if (commitDialogOpen) {
      setMessage('');
      setTag('');
    }
  }, [commitDialogOpen]);

  // Compute change summary
  const diff = useMemo(() => {
    if (!commitDialogOpen) return null;
    const base = headCommit ? { nodes: headCommit.nodes, edges: headCommit.edges } : { nodes: [], edges: [] };
    return computeGraphDiff(base, { nodes, edges });
  }, [commitDialogOpen, headCommit, nodes, edges]);

  if (!commitDialogOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalMsg = message.trim();
    if (!finalMsg) {
      addToast('Commit message is required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await doCommit({
        message: finalMsg,
        tag: tag.trim() || null,
        nodes,
        edges,
        drawings
      });

      if (res.ok) {
        addToast(res.skipped ? 'No changes detected to commit' : 'Version committed successfully!', 'success');
        closeCommitDialog();
      } else {
        addToast(res.error || 'Failed to commit version', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error committing version', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const changesList = [];
  if (diff?.summary) {
    const s = diff.summary;
    if (s.nodesAdded > 0) changesList.push(`• ${s.nodesAdded} node${s.nodesAdded > 1 ? 's' : ''} added`);
    if (s.nodesRemoved > 0) changesList.push(`• ${s.nodesRemoved} node${s.nodesRemoved > 1 ? 's' : ''} removed`);
    if (s.nodesModified > 0) changesList.push(`• ${s.nodesModified} node${s.nodesModified > 1 ? 's' : ''} modified`);
    if (s.nodesMoved > 0) changesList.push(`• ${s.nodesMoved} node position${s.nodesMoved > 1 ? 's' : ''} adjusted`);
    if (s.edgesAdded > 0) changesList.push(`• ${s.edgesAdded} connection${s.edgesAdded > 1 ? 's' : ''} added`);
    if (s.edgesRemoved > 0) changesList.push(`• ${s.edgesRemoved} connection${s.edgesRemoved > 1 ? 's' : ''} removed`);
  }

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="relative bg-background border-2 border-foreground rounded-2xl p-6 shadow-2xl max-w-md w-full mx-4 animate-in fade-in zoom-in-95 duration-200"
        style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}
      >
        {/* Close Button */}
        <button
          onClick={closeCommitDialog}
          className="absolute top-4 right-4 p-1 rounded-full text-foreground/40 hover:text-foreground hover:bg-foreground/10 transition-all cursor-pointer"
          aria-label="Close dialog"
        >
          <X size={16} />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/20">
            <GitCommit size={18} className="text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-mono text-foreground leading-tight">Commit Version</h2>
            <p className="text-[11px] text-foreground/50 mt-0.5">Save active state to branch: {activeBranch}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Commit Message */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground/50 mb-1.5">
              Commit Message / Summary
            </label>
            <textarea
              autoFocus
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g., Add data augmentation step, tune hyperparameters..."
              className="w-full h-24 rounded-xl border-2 border-foreground/25 bg-foreground/5 p-3 text-xs font-semibold text-foreground outline-none transition-colors focus:border-foreground/60 placeholder:text-foreground/25 resize-none"
              required
            />
          </div>

          {/* Optional Tag */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground/50 mb-1.5 flex items-center gap-1.5">
              <Tag size={10} /> Version Tag (Optional)
            </label>
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="e.g., v1.0, baseline-run"
              className="w-full h-10 rounded-xl border-2 border-foreground/25 bg-foreground/5 px-4 text-xs font-semibold text-foreground outline-none transition-colors focus:border-foreground/60 placeholder:text-foreground/25"
            />
          </div>

          {/* Change Summary */}
          {changesList.length > 0 && (
            <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-3">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-foreground/40 mb-1.5">
                Changes detected in this version
              </span>
              <div className="font-mono text-[10px] text-foreground/70 space-y-0.5 max-h-24 overflow-y-auto">
                {changesList.map((c, idx) => (
                  <div key={idx}>{c}</div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={closeCommitDialog}
              className="flex-1 py-2.5 border border-foreground/15 text-foreground/70 rounded-xl font-bold text-sm hover:bg-foreground/5 hover:text-foreground transition-all cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !message.trim()}
              className="flex-1 py-2.5 bg-foreground text-background rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <span className="inline-block w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
              ) : null}
              {isSubmitting ? 'Saving...' : 'Save Version'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
