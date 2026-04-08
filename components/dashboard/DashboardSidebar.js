'use client'

import React from 'react'
import { Home, Folder, Users, Clock, Star, Trash2, Plus, HardDrive, LogOut, User as UserIcon, ChevronRight, ChevronDown, FileText, Layout as LayoutIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SidebarTreeSkeleton, Shimmer } from './DashboardSkeleton'

const DashboardSidebar = ({ onNew, activeTab, onTabChange, user, profile, groupedPipelines = {}, onSignOut, loading = false }) => {
  const [expandedFolders, setExpandedFolders] = React.useState([])

  const toggleFolder = (folderName) => {
    setExpandedFolders(prev => 
      prev.includes(folderName) 
        ? prev.filter(f => f !== folderName) 
        : [...prev, folderName]
    )
  }

  const navItems = [
    { icon: Home, label: 'Home' },
    { icon: Users, label: 'Shared with me' },
    { icon: Clock, label: 'Recent' },
    { icon: Star, label: 'Starred' },
  ]

  return (
    <aside className="w-64 h-screen bg-background border-r border-foreground/5 flex flex-col shrink-0 overflow-hidden relative">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-4 mb-10 mt-2">
          <img src="/logo.png" alt="Proto-ML Logo" className="w-12 h-12 object-contain" />
          <h1 className="text-xl font-bold tracking-tighter uppercase font-mono text-foreground">Proto-ML</h1>
        </div>

        {/* New Canvas Button */}
        <div className="mb-8 px-2">
          <button
            onClick={onNew}
            className="flex items-center gap-4 w-full px-6 py-4 bg-foreground text-background rounded-2xl transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] group"
          >
            <div className="bg-background text-foreground p-1 rounded-md transition-transform">
              <Plus size={20} strokeWidth={3} />
            </div>
            <span className="font-bold text-lg tracking-tight">New Canvas</span>
          </button>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item, index) => (
            <button
              key={index}
              onClick={() => onTabChange(item.label)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-full transition-all group ${
                activeTab === item.label
                  ? 'bg-foreground/10 text-foreground font-bold' 
                  : 'text-foreground/50 hover:bg-foreground/5 hover:text-foreground'
              }`}
            >
              <item.icon size={20} className={activeTab === item.label ? 'text-foreground' : 'text-foreground/40 group-hover:text-foreground'} />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
          
          {/* Dynamic Folder Tree (integrated with main nav) */}
          <div className="space-y-1 mt-4">
            {loading ? (
              <SidebarTreeSkeleton />
            ) : (
              Object.entries(groupedPipelines).map(([folderName, pipelines]) => {
                if (folderName === 'Starred') return null;
                const isExpanded = expandedFolders.includes(folderName);
                
                return (
                  <div key={folderName} className="space-y-1">
                    <button
                      onClick={() => toggleFolder(folderName)}
                      className={`w-full flex items-center gap-4 px-4 py-3 rounded-full transition-all group/folder ${isExpanded ? 'bg-foreground/5' : 'text-foreground/50 hover:bg-foreground/5 hover:text-foreground'}`}
                    >
                      <Folder 
                        size={20} 
                        className={isExpanded ? 'text-amber-400' : 'text-foreground/40 group/folder:text-foreground'} 
                      />
                      <span className={`text-sm flex-1 text-left ${isExpanded ? 'font-bold text-foreground' : 'font-medium'}`}>{folderName}</span>
                      {isExpanded ? <ChevronDown size={14} className="text-foreground/40" /> : <ChevronRight size={14} className="text-foreground/40" />}
                    </button>
                    
                    {isExpanded && (
                      <div className="ml-8 space-y-1 border-l border-foreground/5 pl-2">
                        {pipelines.length === 0 ? (
                          <div className="px-4 py-1 text-[10px] text-foreground/20 font-medium italic">Empty Folder</div>
                        ) : pipelines.map(p => (
                          <Link
                            key={p.id}
                            href={`/canvas/${p.id}`}
                            className="flex items-center gap-3 px-4 py-2 rounded-xl text-foreground/40 hover:bg-foreground/5 hover:text-foreground transition-all group/file"
                          >
                            <FileText size={16} className="text-foreground/20 group-hover/file:text-foreground/40" />
                            <span className="text-xs font-medium truncate">{p.name || 'Untitled'}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="h-px bg-foreground/5 my-4 mx-2" />
          
          <Link
            href="/community"
            className="flex items-center gap-4 px-4 py-3 rounded-full transition-all group text-amber-400/60 hover:bg-amber-400/5 hover:text-amber-400"
          >
            <Users size={20} />
            <span className="text-sm font-medium">Community Gallery</span>
          </Link>
        </nav>
      </div>

      {/* Profile Section - Sticky Bottom */}
      <div className="mt-auto bg-background border-t border-foreground/5 px-4 py-3 sticky bottom-0 z-10 w-full flex items-center gap-3 group/profile">
        <Link 
          href="/profile" 
          className="flex items-center gap-3 flex-1 min-w-0"
        >
          <div className="w-10 h-10 rounded-xl bg-foreground/10 border border-foreground/5 flex items-center justify-center overflow-hidden shrink-0 group-hover/profile:scale-105 transition-transform">
            {profile?.avatar_url || user?.user_metadata?.avatar_url ? (
              <img src={profile?.avatar_url || user?.user_metadata?.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <UserIcon size={20} className="text-foreground/40" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            {loading && !profile && !user ? (
              <div className="space-y-1">
                <div className="h-3 w-20 bg-foreground/10 rounded relative overflow-hidden"><Shimmer /></div>
                <div className="h-2 w-12 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
              </div>
            ) : (
              <>
                <span className="text-sm font-bold text-foreground truncate leading-tight">{profile?.username || profile?.full_name || user?.email?.split('@')[0] || 'User'}</span>
                <span className="text-[10px] text-foreground/30 truncate uppercase tracking-widest font-bold">Pro Member</span>
              </>
            )}
          </div>
        </Link>
        
        <button 
          onClick={onSignOut}
          className="p-2 text-foreground/20 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
          title="Sign Out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  )
}

export default DashboardSidebar
