'use client'

import Link from 'next/link'
import { Layout } from 'lucide-react'
import InfiniteCanvas from '@/components/InfiniteCanvas'
import DashboardNav from '@/components/DashboardNav'
import DashboardProfile from '@/components/DashboardProfile'
import PipelineCompilerPanel from '@/components/PipelineCompilerPanel'

const Page = () => {
  return (
    <div className="w-full h-screen relative">
      <DashboardNav />
      <DashboardProfile />
      <PipelineCompilerPanel />
      <InfiniteCanvas />
      <Link
        href="/dashboard"
        className="absolute bottom-4 left-4 z-100 flex items-center gap-2 px-4 py-2 bg-foreground text-background text-xs font-bold rounded-full hover:opacity-90 transition-all shadow-xl"
      >
        <Layout size={14} /> My Projects
      </Link>
    </div>
  )
}

export default Page
