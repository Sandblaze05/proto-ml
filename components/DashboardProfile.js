'use client'

import React from 'react'
import { MoreVertical } from 'lucide-react'

const DashboardProfile = () => {
  return (
    <div className='z-100 fixed top-2 right-2 flex items-center justify-around gap-4'>
      <div className='border-3 border-foreground rounded-full w-11 h-11'>
        <span className='w-full h-full flex items-center justify-center font-extrabold text-foreground text-xl'>
          U
        </span>
      </div>

      <div className='border-3 border-foreground rounded-full w-11 h-11'>
        <span className='w-full h-full flex items-center justify-center font-extrabold text-foreground text-xl'>
          <MoreVertical />
        </span>
      </div>
    </div>
  )
}

export default DashboardProfile