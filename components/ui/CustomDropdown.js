'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

const CustomDropdown = ({ 
  value, 
  onChange, 
  options, 
  label, 
  variant = 'pill', // 'pill' or 'input'
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  const currentOption = options.find(o => o.value === value) || options[0]

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const triggerClasses = variant === 'pill' 
    ? "flex items-center gap-2 pl-4 pr-3 py-1.5 rounded-full hover:bg-foreground/5 transition-colors group h-9 border border-foreground/5 bg-foreground/5"
    : "w-full flex items-center justify-between px-4 py-3 rounded-xl border border-foreground/10 bg-foreground/5 hover:border-foreground/20 transition-all text-sm text-foreground group"

  return (
    <div className={`relative ${variant === 'input' ? 'w-full' : 'inline-block'} ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={triggerClasses}
      >
        <div className="flex items-center gap-3">
            {currentOption.icon && (
                <div className={`p-1.5 rounded-lg transition-colors ${variant === 'input' ? 'bg-foreground/5 group-hover:bg-foreground/10' : ''}`}>
                    <currentOption.icon size={variant === 'pill' ? 14 : 16} className="text-foreground/40" />
                </div>
            )}
            <div className="flex flex-col items-start leading-tight">
                {variant === 'pill' ? (
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-foreground/40 group-hover:text-foreground/70 transition-colors">
                        {currentOption.label}
                    </span>
                ) : (
                    <span className="font-bold text-foreground/80 group-hover:text-foreground transition-colors">
                        {currentOption.label}
                    </span>
                )}
            </div>
        </div>
        <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        >
            <ChevronDown size={variant === 'pill' ? 14 : 18} className="text-foreground/30 group-hover:text-foreground/50 transition-colors" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.95, y: 8, filter: 'blur(8px)' }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className={`absolute top-full ${variant === 'input' ? 'left-0 right-0' : 'md:left-0 right-0'} mt-2 min-w-[200px] bg-background/80 backdrop-blur-xl border border-foreground/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] py-3 z-[200] overflow-hidden origin-top`}
          >
            {label && (
                <div className="px-4 py-1.5 mb-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/20">{label}</span>
                </div>
            )}
            <div className="px-1.5">
                {options.map((option) => {
                const Icon = option.icon
                const isActive = value === option.value
                return (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                            onChange(option.value)
                            setIsOpen(false)
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-tight transition-all relative group/item ${
                            isActive ? 'bg-amber-400/5 text-amber-400' : 'text-foreground/50 hover:bg-foreground/5 hover:text-foreground'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            {Icon && (
                                <div className={`p-1.5 rounded-lg transition-colors ${isActive ? 'bg-amber-400/10' : 'bg-foreground/5 group-hover/item:bg-foreground/10'}`}>
                                    <Icon size={14} className={isActive ? 'text-amber-400' : 'text-foreground/30'} />
                                </div>
                            )}
                            {option.label}
                        </div>
                        {isActive && (
                            <motion.div 
                                layoutId={`active-indicator-${label}`}
                                className="w-1 h-4 bg-amber-400 rounded-full"
                            />
                        )}
                    </button>
                )
                })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default CustomDropdown
