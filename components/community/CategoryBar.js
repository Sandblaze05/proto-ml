'use client'

import React from 'react'
import { Filter, ChevronRight, ChevronLeft } from 'lucide-react'

const CATEGORIES = [
	{ id: 'all', name: 'All Pipelines', color: 'foreground' },
	{ id: 'cv', name: 'Computer Vision', color: 'purple-500', tag: 'Computer Vision' },
	{ id: 'nlp', name: 'NLP', color: 'blue-500', tag: 'NLP' },
	{ id: 'genai', name: 'Generative AI', color: 'amber-400', tag: 'Generative AI' },
	{ id: 'analytics', name: 'Analytics', color: 'emerald-400', tag: 'Analytics' },
	{ id: 'prep', name: 'Data Prep', color: 'red-400', tag: 'Data Preparation' },
	{ id: 'audio', name: 'Audio', color: 'indigo-400', tag: 'Audio' },
	{ id: 'cloud', name: 'Cloud/MLOps', color: 'cyan-400', tag: 'Cloud' }
]

export { CATEGORIES }

const CategoryBar = ({ selectedCategory, onSelect }) => {
	const scrollRef = React.useRef(null)

	const scroll = (direction) => {
		if (scrollRef.current) {
			const { current } = scrollRef
			const scrollAmount = 200
			if (direction === 'left') {
				current.scrollBy({ left: -scrollAmount, behavior: 'smooth' })
			} else {
				current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
			}
		}
	}

	return (
		<div className="relative mb-12 flex items-center group">
			{/* Icon */}
			<div className="shrink-0 mr-4 text-foreground/40 hidden md:flex items-center gap-2 font-black uppercase text-[10px] tracking-widest">
				<Filter size={16} /> Filters
			</div>

			{/* Custom Scroll Buttons (Visible on Hover) */}
			<button 
				onClick={() => scroll('left')}
				className="absolute left-[-20px] z-20 p-2 bg-background border border-foreground/10 rounded-full shadow-xl opacity-0 group-hover:opacity-100 transition-opacity hidden md:block"
			>
				<ChevronLeft size={16} />
			</button>

			<div 
				ref={scrollRef}
				className="flex-1 flex items-center gap-3 overflow-x-auto no-scrollbar pb-2"
			>
				{CATEGORIES.map((cat) => (
					<button
						key={cat.id}
						onClick={() => onSelect(cat.id)}
						className={`
							shrink-0 px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-tighter transition-all relative group/btn
							${selectedCategory === cat.id 
								? `bg-foreground text-background shadow-[0_0_20px_-5px_currentColor]` 
								: 'bg-foreground/3 border border-foreground/5 text-foreground/50 hover:bg-foreground/[0.07] hover:border-foreground/20 hover:text-foreground'
							}
						`}
						style={{
							boxShadow: selectedCategory === cat.id ? `0 0 20px -5px var(--tw-shadow-color)` : 'none',
							'--tw-shadow-color': cat.color === 'foreground' ? 'rgba(255,255,255,0.2)' : `rgba(${cat.color}, 0.3)`
						}}
					>
						{/* Active Glow for specific colors */}
						{selectedCategory === cat.id && cat.color !== 'foreground' && (
							<div className={`absolute inset-0 rounded-2xl bg-${cat.color}/30 blur-md -z-10`} />
						)}
						{cat.name}
					</button>
				))}
			</div>

			<button 
				onClick={() => scroll('right')}
				className="absolute right-[-20px] z-20 p-2 bg-background border border-foreground/10 rounded-full shadow-xl opacity-0 group-hover:opacity-100 transition-opacity hidden md:block"
			>
				<ChevronRight size={16} />
			</button>

			<style jsx global>{`
				.no-scrollbar::-webkit-scrollbar {
					display: none;
				}
				.no-scrollbar {
					-ms-overflow-style: none;
					scrollbar-width: none;
				}
			`}</style>
		</div>
	)
}

export default CategoryBar
