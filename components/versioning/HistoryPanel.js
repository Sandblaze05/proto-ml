'use client';

import React, { useEffect, useRef } from 'react';
import { X, GitCommit, RotateCcw, ArrowLeftRight, Check, Tag } from 'lucide-react';
import { useVersionStore } from '@/store/useVersionStore';
import { useUIStore } from '@/store/useUIStore';
import gsap from 'gsap';

export default function HistoryPanel() {
  const {
    historyPanelOpen,
    toggleHistoryPanel,
    commits,
    commitsLoading,
    commitsHasMore,
    loadCommits,
    doRestore,
    activeBranch,
    compareMode,
    diffSource,
    compareWithCommit,
    exitCompareMode
  } = useVersionStore();

  const { nodes, edges, drawings, addToast } = useUIStore();
  const panelRef = useRef(null);

  // Smooth slide-in transition using GSAP
  useEffect(() => {
    if (!panelRef.current) return;
    if (historyPanelOpen) {
      gsap.to(panelRef.current, {
        x: 0,
        duration: 0.4,
        ease: 'power3.out',
        overwrite: 'auto'
      });
    } else {
      gsap.to(panelRef.current, {
        x: '100%',
        duration: 0.4,
        ease: 'power3.inOut',
        overwrite: 'auto'
      });
    }
  }, [historyPanelOpen]);

  const handleRestore = async (commitId, commitMsg) => {
    if (!window.confirm(`Are you sure you want to restore to version: "${commitMsg}"? This will save your current canvas changes as a commit and revert the workspace back to this state.`)) {
      return;
    }

    try {
      const res = await doRestore(commitId);
      if (res.ok) {
        useUIStore.getState().setNodes(res.nodes);
        useUIStore.getState().setEdges(res.edges || []);
        useUIStore.getState().setDrawings(res.drawings || []);
        addToast(`Restored to version: "${commitMsg}"`, 'success');
        toggleHistoryPanel();
      } else {
        addToast(res.error || 'Failed to restore version', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error restoring version', 'error');
    }
  };

  const handleCompare = (commitId) => {
    if (compareMode && diffSource === commitId) {
      exitCompareMode();
    } else {
      compareWithCommit(commitId, { nodes, edges });
      addToast('Entered compare mode. Faded/colored nodes show differences.', 'info');
    }
  };

  const formatRelativeTime = (dateString) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 600);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${diffDays}d ago`;
    } catch (e) {
      return '';
    }
  };

  return (
    <div
      ref={panelRef}
      style={{ transform: 'translateX(100%)' }}
      className="fixed top-16 bottom-4 right-4 w-96 bg-background/95 border-2 border-foreground rounded-2xl shadow-2xl z-[150] flex flex-col overflow-hidden backdrop-blur-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-foreground/15">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">
            Version History
          </span>
          <span className="text-xs font-bold font-mono text-cyan-400 mt-0.5">
            branch: {activeBranch}
          </span>
        </div>
        <button
          onClick={toggleHistoryPanel}
          className="p-1 rounded-full text-foreground/40 hover:text-foreground hover:bg-foreground/10 transition-all cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      {/* Commits List */}
      <div className="flex-1 overflow-y-auto p-4 relative">
        {commitsLoading && commits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <span className="inline-block w-6 h-6 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
            <span className="text-[10px] uppercase font-black tracking-wider text-foreground/40">Loading history...</span>
          </div>
        ) : commits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div className="w-12 h-12 rounded-full border-2 border-foreground/20 flex items-center justify-center text-foreground/30 mb-3">
              <GitCommit size={20} />
            </div>
            <p className="text-xs text-foreground/50 leading-relaxed font-mono">
              No versions committed yet. Make some changes on the canvas and click "Commit".
            </p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-6">
            {/* Timeline vertical bar */}
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-foreground/10" />

            {commits.map((commit, idx) => {
              const isComparingThis = compareMode && diffSource === commit.id;
              return (
                <div key={commit.id} className="relative group">
                  {/* Timeline point */}
                  <div className={`absolute -left-[23px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-background flex items-center justify-center z-10 ${
                    idx === 0 ? 'bg-cyan-400' : 'bg-foreground/50'
                  }`} />

                  {/* Commit info card */}
                  <div className="flex flex-col gap-1.5 p-3 rounded-xl border border-foreground/10 bg-foreground/5 hover:bg-foreground/8 transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-bold text-foreground leading-snug">
                        {commit.message || 'Auto-save'}
                      </span>
                      <span className="text-[9px] font-mono text-foreground/40 shrink-0 mt-0.5">
                        #{commit.commit_number}
                      </span>
                    </div>

                    {/* Metadata line */}
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-mono text-foreground/40">
                        {formatRelativeTime(commit.created_at)}
                      </span>
                      {commit.tag && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-400/10 text-amber-300 border border-amber-400/20 text-[8px] font-black uppercase tracking-wider">
                          <Tag size={8} />
                          <span>{commit.tag}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-2 pt-2 border-t border-foreground/5">
                      {/* Restore */}
                      <button
                        onClick={() => handleRestore(commit.id, commit.message)}
                        className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-lg border border-foreground/15 text-[10px] font-bold uppercase hover:bg-foreground hover:text-background transition-all cursor-pointer"
                        title="Checkout this version"
                      >
                        <RotateCcw size={11} />
                        <span>Restore</span>
                      </button>

                      {/* Compare */}
                      <button
                        onClick={() => handleCompare(commit.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 h-7 rounded-lg border text-[10px] font-bold uppercase transition-all cursor-pointer ${
                          isComparingThis
                            ? 'bg-amber-400/20 text-amber-300 border-amber-400/30'
                            : 'border-foreground/15 hover:bg-foreground hover:text-background'
                        }`}
                        title={isComparingThis ? 'Exit comparison' : 'Compare with workspace'}
                      >
                        {isComparingThis ? <Check size={11} /> : <ArrowLeftRight size={11} />}
                        <span>{isComparingThis ? 'Comparing' : 'Compare'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {commitsHasMore && (
        <div className="p-4 border-t border-foreground/15 shrink-0 bg-background/60">
          <button
            onClick={() => loadCommits(true)}
            disabled={commitsLoading}
            className="w-full py-2 border border-foreground/15 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-foreground/5 transition-all text-center disabled:opacity-40 cursor-pointer"
          >
            {commitsLoading ? 'Loading more...' : 'Load older versions'}
          </button>
        </div>
      )}
    </div>
  );
}
