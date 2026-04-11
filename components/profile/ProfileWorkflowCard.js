import React from 'react'
import { Globe, Edit3, Sliders, Heart } from 'lucide-react'
import Link from 'next/link'

const ProfileWorkflowCard = ({ pipeline }) => {
	const formatDate = (dateString) => {
		const date = new Date(dateString)
		const now = new Date()
		const diffMs = now - date
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
		
		if (diffDays === 0) return 'Today'
		if (diffDays < 30) return `${diffDays} days ago`
		if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
		return `${Math.floor(diffDays / 365)} years ago`
	}

	return (
		<div className="group relative border-b border-foreground/5 last:border-0 hover:bg-foreground/[0.01] transition-colors p-5 lg:p-6 text-left">
			<div className="flex items-center justify-between gap-4">
				<div className="flex-1 space-y-1.5 min-w-0">
					<h3 className="text-base font-semibold text-foreground/90 group-hover:text-amber-400 transition-colors leading-snug">
						{pipeline.name || 'Untitled Workflow'}
					</h3>
					<div className="flex items-center gap-3 text-sm text-foreground/40">
						<div className="flex items-center gap-1.5">
							<Heart size={14} className="opacity-70 fill-red-500/20 text-red-500" />
							<span className="font-bold text-foreground/60">{pipeline.likes_count || 0}</span>
						</div>
						<span className="opacity-30">•</span>
						<span>{formatDate(pipeline.updated_at)}</span>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<div className="flex items-center gap-1 p-1 rounded-xl bg-foreground/2 border border-foreground/5">
						<button className="p-2 rounded-lg hover:bg-foreground/5 text-foreground/30 hover:text-foreground/80 transition-all active:scale-95">
							<Globe size={16} />
						</button>
						<button className="p-2 rounded-lg hover:bg-foreground/5 text-foreground/30 hover:text-foreground/80 transition-all active:scale-95">
							<Edit3 size={16} />
						</button>
						<button className="p-2 rounded-lg hover:bg-foreground/5 text-foreground/30 hover:text-foreground/80 transition-all active:scale-95">
							<Sliders size={16} />
						</button>
					</div>
				</div>
			</div>
			
			<Link 
				href={`/canvas/${pipeline.id}?access=view`} 
				className="absolute inset-0 z-10"
				aria-label={`View ${pipeline.name}`}
			/>
		</div>
	)
}

export default ProfileWorkflowCard
