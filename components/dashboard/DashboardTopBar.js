'use client'

import React from 'react'
import { Search, Settings, HelpCircle, Bell, SortAsc, SortDesc, Clock, Layout } from 'lucide-react'
import CustomDropdown from '@/components/ui/CustomDropdown'

const DashboardTopBar = ({ user, profile, searchQuery, setSearchQuery, sortBy, setSortBy, sortOrder, setSortOrder }) => {
  const sortOptions = [
    { value: 'updated_at', label: 'Last Updated', icon: Clock },
    { value: 'name', label: 'Pipeline Name', icon: Layout },
  ]

  return (
    <header className="h-16 flex items-center justify-between px-8 bg-background border-b border-foreground/5 sticky top-0 z-50">
      <div className="flex items-center gap-6 flex-1">
        <div className="max-w-xl w-full relative group">
          < Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/30 group-focus-within:text-foreground/60 transition-colors" size={20} />
          <input
            type="text"
            placeholder="Search pipelines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 bg-foreground/5 border border-transparent rounded-full pl-12 pr-4 text-sm focus:bg-background focus:border-foreground/10 outline-none transition-all shadow-sm focus:shadow-md placeholder:text-foreground/20 font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
            <CustomDropdown 
                value={sortBy} 
                onChange={setSortBy} 
                options={sortOptions} 
                variant="pill"
                label="Sort View By"
            />
            
            <button
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className={`p-2 rounded-full transition-all group ${
                    sortOrder === 'asc' ? 'text-amber-400 hover:bg-amber-400/10' : 'text-foreground/40 hover:text-foreground hover:bg-foreground/10'
                }`}
                title={sortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
            >
                {sortOrder === 'asc' ? <SortAsc size={18} /> : <SortDesc size={18} />}
            </button>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4">
        <button className="p-2.5 text-foreground/50 hover:bg-foreground/5 hover:text-foreground rounded-full transition-all" title="Help">
          <HelpCircle size={20} />
        </button>
        <button className="p-2.5 text-foreground/50 hover:bg-foreground/5 hover:text-foreground rounded-full transition-all" title="Settings">
          <Settings size={20} />
        </button>
        
        <div className="w-px h-6 bg-foreground/10 mx-2" />
        
        <button className="p-2.5 text-foreground/50 hover:bg-foreground/5 hover:text-foreground rounded-full transition-all relative" title="Notifications">
            <Bell size={20} />
            <div className="absolute top-2 right-2 w-2 h-2 bg-amber-400 rounded-full border-2 border-background" />
        </button>
      </div>
    </header>
  )
}

export default DashboardTopBar
