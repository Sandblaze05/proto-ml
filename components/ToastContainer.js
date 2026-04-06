'use client'

import React, { useEffect, useRef } from 'react'
import { useUIStore } from '@/store/useUIStore'
import { X, CheckCircle2, AlertCircle, Info, Bell } from 'lucide-react'
import gsap from 'gsap'

const ToastContainer = () => {
	const { toasts } = useUIStore()

	return (
		<div className="fixed top-6 left-0 right-0 z-[10000] flex flex-col items-center gap-3 pointer-events-none">
			{toasts.map((toast) => (
				<ToastItem key={toast.id} toast={toast} />
			))}
		</div>
	)
}

const ToastItem = ({ toast }) => {
	const { removeToast } = useUIStore()
	const itemRef = useRef(null)

	useEffect(() => {
		gsap.fromTo(itemRef.current,
			{ y: -20, opacity: 0, scale: 0.9 },
			{ y: 0, opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.7)' }
		)
	}, [])

	const handleRemove = () => {
		gsap.to(itemRef.current, {
			opacity: 0,
			scale: 0.9,
			y: -10,
			duration: 0.2,
			onComplete: () => removeToast(toast.id)
		})
	}

	return (
		<div 
			ref={itemRef}
			className="flex items-center gap-4 px-6 py-3 bg-background/90 backdrop-blur-3xl border border-foreground/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] min-w-[340px] pointer-events-auto"
		>
			<div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
				toast.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 
				toast.type === 'error' ? 'bg-red-500/20 text-red-400' : 
				'bg-blue-500/20 text-blue-400'
			}`}>
				{toast.type === 'success' ? <CheckCircle2 size={20} /> : 
				 toast.type === 'error' ? <AlertCircle size={20} /> : 
				 <Info size={20} />}
			</div>
			
			<div className="flex-1">
				<div className="text-[10px] font-bold font-mono text-foreground/40 uppercase tracking-widest mb-0.5">
					{toast.type || 'info'}
				</div>
				<div className="text-[13px] text-foreground font-bold leading-tight">
					{toast.message}
				</div>
			</div>
			
			<button 
				onClick={handleRemove}
				className="p-1 hover:bg-foreground/10 rounded-lg transition-colors text-foreground/30 hover:text-foreground"
			>
				<X size={18} />
			</button>
		</div>
	)
}

export default ToastContainer
