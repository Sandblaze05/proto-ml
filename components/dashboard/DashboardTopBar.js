'use client'

import React from 'react'
import { Search, Settings, HelpCircle, Bell, SortAsc, SortDesc, Clock, Layout, Menu, X } from 'lucide-react'
import CustomDropdown from '@/components/ui/CustomDropdown'

const DashboardTopBar = ({ user, profile, searchQuery, setSearchQuery, sortBy, setSortBy, sortOrder, setSortOrder, toggleSidebar }) => {
  const sortOptions = [
    { value: 'updated_at', label: 'Last Updated', icon: Clock },
    { value: 'name', label: 'Pipeline Name', icon: Layout },
  ]

  return (
    <header className="h-16 flex items-center justify-between px-4 lg:px-8 bg-background border-b border-foreground/5 sticky top-0 z-50">
      <div className="flex items-center gap-2 lg:gap-6 flex-1 min-w-0">
        <button 
          onClick={toggleSidebar}
          className="lg:hidden p-2 text-foreground/50 hover:text-foreground hover:bg-foreground/5 rounded-xl transition-all shrink-0"
        >
          <Menu size={24} />
        </button>

        {/* Global Search Bar */}
        <div className="max-w-xl w-full relative group">
          < Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-foreground/30 group-focus-within:text-[#FAEBD7]/60 transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 bg-foreground/5 border border-transparent rounded-xl sm:rounded-full pl-10 sm:pl-12 pr-4 text-sm focus:bg-background focus:border-[#FAEBD7]/20 outline-none transition-all shadow-sm focus:shadow-md placeholder:text-foreground/20 font-medium"
          />
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <div className="hidden md:block">
                <CustomDropdown 
                    value={sortBy} 
                    onChange={setSortBy} 
                    options={sortOptions} 
                    variant="pill"
                    label="Sort View By"
                />
            </div>
            
            <button
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className={`p-2 rounded-full transition-all group ${
                    sortOrder === 'asc' ? 'text-[#FAEBD7] hover:bg-[#FAEBD7]/10' : 'text-foreground/40 hover:text-foreground hover:bg-foreground/10'
                }`}
                title={sortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
            >
                {sortOrder === 'asc' ? <SortAsc size={18} /> : <SortDesc size={18} />}
            </button>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1 sm:gap-2 ml-2 sm:ml-4 shrink-0">
        <button className="hidden sm:block p-2 text-foreground/50 hover:bg-foreground/5 hover:text-foreground rounded-full transition-all" title="Help">
          <HelpCircle size={18} />
        </button>
        <button className="hidden sm:block p-2 text-foreground/50 hover:bg-foreground/5 hover:text-foreground rounded-full transition-all" title="Settings">
          <Settings size={18} />
        </button>
        
        <div className="hidden sm:block w-px h-6 bg-foreground/10 mx-1" />
        
        <button className="p-2 text-foreground/50 hover:bg-foreground/5 hover:text-foreground rounded-full transition-all relative" title="Notifications">
          <Bell size={18} />
          <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-[#FAEBD7] rounded-full border border-background" />
        </button>
      </div>
    </header>
  )
}

export default DashboardTopBar
