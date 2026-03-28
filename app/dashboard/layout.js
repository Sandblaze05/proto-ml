import React from 'react'
import DashboardNav from '@/components/DashboardNav'
import DashboardProfile from '@/components/DashboardProfile'
import PipelineCompilerPanel from '@/components/PipelineCompilerPanel'

const layout = ({ children }) => {
  return (
    <div>
        <DashboardProfile />
        <DashboardNav />
        <PipelineCompilerPanel />
        {children}
    </div>
  )
}

export default layout