import React from 'react'
import DashboardNav from '@/components/DashboardNav'
import DashboardProfile from '@/components/DashboardProfile'

const layout = ({ children }) => {
  return (
    <div>
        <DashboardProfile />
        <DashboardNav />
        {children}
    </div>
  )
}

export default layout