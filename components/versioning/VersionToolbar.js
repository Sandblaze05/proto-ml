'use client';

import React, { useState, useRef, useEffect } from 'react';
import { GitBranch, GitCommit, History, Plus, Search, X, ArrowLeftRight } from 'lucide-react';
import { useVersionStore } from '@/store/useVersionStore';
import { useUIStore } from '@/store/useUIStore';

export default function VersionToolbar() {
  const {
    activeBranch,
    isDirty,
    branches,
    historyPanelOpen,
    compareMode,
    toggleHistoryPanel,
    doCreateBranch,
    doSwitchBranch,
    openCommitDialog,
    exitCompareMode,
    initialized
  } = useVersionStore();

  const { nodes, edges, drawings, addToast } = useUIStore();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [creatingBranch, setCreatingBranch] = useState(false);

  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!initialized) return null;

  const filteredBranches = branches.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    const name = newBranchName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!name) return;

    if (branches.some((b) => b.name === name)) {
      addToast('A branch with this name already exists', 'error');
      return;
    }

    setCreatingBranch(true);
    try {
      const res = await doCreateBranch(name);
      if (res.ok) {
        addToast(`Branch "${name}" created successfully`, 'success');
        setNewBranchName('');
        // Switch to the newly created branch
        const switchRes = await doSwitchBranch(name, { nodes, edges, drawings });
        if (switchRes.ok) {
          if (switchRes.nodes) {
            useUIStore.getState().setNodes(switchRes.nodes);
            useUIStore.getState().setEdges(switchRes.edges || []);
            useUIStore.getState().setDrawings(switchRes.drawings || []);
          }
          addToast(`Switched to branch "${name}"`, 'success');
        }
        setDropdownOpen(false);
      } else {
        addToast(res.error || 'Failed to create branch', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error creating branch', 'error');
    } finally {
      setCreatingBranch(false);
    }
  };

  const handleBranchSwitch = async (branchName) => {
    if (branchName === activeBranch) return;
    try {
      const res = await doSwitchBranch(branchName, { nodes, edges, drawings });
      if (res.ok) {
        if (res.nodes) {
          useUIStore.getState().setNodes(res.nodes);
          useUIStore.getState().setEdges(res.edges || []);
          useUIStore.getState().setDrawings(res.drawings || []);
        }
        addToast(`Switched to branch "${branchName}"`, 'success');
        setDropdownOpen(false);
      } else {
        addToast(res.error || 'Failed to switch branch', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error switching branch', 'error');
    }
  };

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-200 flex items-center gap-2">
      {/* Compare Mode Status indicator */}
      {compareMode && (
        <div className="flex items-center gap-2 h-10 px-4 rounded-full bg-amber-400 text-black border border-amber-300 shadow-lg text-[10px] font-black uppercase tracking-wider animate-pulse">
          <ArrowLeftRight size={14} />
          <span>Compare Mode</span>
          <button
            onClick={exitCompareMode}
            className="ml-1 p-1 hover:bg-black/10 rounded-full transition-colors cursor-pointer"
            title="Exit compare mode"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Main Version Controls Pill */}
      <div className="flex items-center bg-background/95 border-2 border-foreground/40 rounded-full h-10 shadow-lg backdrop-blur px-1.5 gap-1.5 box-border">
        {/* Branch Selector Dropdown Trigger */}
        <div className="relative" ref={containerRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase h-7 transition-all cursor-pointer ${
              dropdownOpen
                ? 'bg-foreground text-background'
                : 'text-foreground/80 hover:bg-foreground/5 hover:text-foreground'
            }`}
          >
            <GitBranch size={13} className="shrink-0" />
            <span className="truncate max-w-[100px]">{activeBranch}</span>
            {isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" title="Uncommitted changes" />
            )}
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-background/95 backdrop-blur-xl border border-foreground/20 rounded-2xl shadow-2xl p-3 z-300 flex flex-col gap-2 origin-top-left animate-in fade-in slide-in-from-top-1 duration-150">
              <span className="text-[9px] font-black uppercase tracking-widest text-foreground/40 px-1">
                Branches
              </span>

              {/* Search branch */}
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground/40" />
                <input
                  type="text"
                  placeholder="Search branches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs bg-foreground/5 border border-foreground/10 rounded-xl outline-none focus:border-foreground/30 text-foreground font-medium"
                />
              </div>

              {/* Branch List */}
              <div className="max-h-40 overflow-y-auto pr-1 flex flex-col gap-1">
                {filteredBranches.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => handleBranchSwitch(b.name)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-bold uppercase transition-all text-left cursor-pointer ${
                      b.name === activeBranch
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                        : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'
                    }`}
                  >
                    <span className="truncate">{b.name}</span>
                    {b.is_default && (
                      <span className="text-[9px] font-black opacity-40 lowercase">default</span>
                    )}
                  </button>
                ))}
                {filteredBranches.length === 0 && (
                  <div className="text-[10px] text-foreground/40 py-2 text-center font-mono">
                    No branches found
                  </div>
                )}
              </div>

              <div className="h-px bg-foreground/10 my-1" />

              {/* Create Branch Input */}
              <form onSubmit={handleCreateBranch} className="flex gap-1.5 items-center">
                <input
                  type="text"
                  placeholder="New branch name..."
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  disabled={creatingBranch}
                  className="flex-1 h-8 px-2.5 text-xs bg-foreground/5 border border-foreground/10 rounded-xl outline-none focus:border-foreground/30 text-foreground font-medium"
                />
                <button
                  type="submit"
                  disabled={creatingBranch || !newBranchName.trim()}
                  className="w-8 h-8 rounded-xl bg-foreground text-background flex items-center justify-center cursor-pointer hover:opacity-90 disabled:opacity-30 transition-all shrink-0"
                  title="Create and checkout branch"
                >
                  <Plus size={14} />
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-foreground/20 shrink-0" />

        {/* Commit Button */}
        <button
          onClick={openCommitDialog}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase h-7 transition-all cursor-pointer ${
            isDirty
              ? 'bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 hover:bg-cyan-400/20'
              : 'text-foreground/40 cursor-not-allowed'
          }`}
          disabled={!isDirty}
          title={isDirty ? 'Commit local changes' : 'No changes to commit'}
        >
          <GitCommit size={13} />
          <span>Commit</span>
        </button>

        <div className="w-px h-6 bg-foreground/20 shrink-0" />

        {/* History Toggle Button */}
        <button
          onClick={toggleHistoryPanel}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase h-7 transition-all cursor-pointer ${
            historyPanelOpen
              ? 'bg-foreground text-background shadow-sm'
              : 'text-foreground/80 hover:bg-foreground/5 hover:text-foreground'
          }`}
          title="Toggle version history panel"
        >
          <History size={13} />
          <span>History</span>
        </button>
      </div>
    </div>
  );
}
