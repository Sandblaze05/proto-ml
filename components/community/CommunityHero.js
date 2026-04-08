'use client'

import React from 'react'
import { Sparkles, ArrowRight, GitFork, Heart, Users } from 'lucide-react'
import PipelineThumbnail from '@/components/PipelineThumbnail'
import Link from 'next/link'

const CommunityHero = ({ featuredPipeline, onFork }) => {
	if (!featuredPipeline) return null

	return (
		<div className="relative w-full mb-16 overflow-hidden rounded-[2.5rem] border border-foreground/10 bg-foreground/2 p-8 md:p-12">
			{/* Background Mesh (Static) */}
			<div className="absolute inset-0 pointer-events-none opacity-20">
				<div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-amber-400/20 blur-[120px]" />
				<div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-purple-500/10 blur-[120px]" />
			</div>

			<div className="relative flex flex-col lg:flex-row items-center gap-12 z-10">
				{/* Text Content */}
				<div className="flex-1 text-center lg:text-left">
					<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-500 text-[10px] font-black uppercase tracking-widest mb-6">
						<Sparkles size={12} /> Featured Pipeline of the Week
					</div>
					<h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase leading-[0.9] mb-6">
						Build <span className="text-amber-400">Faster</span><br /> Together.
					</h1>
					<p className="text-lg text-foreground/60 font-medium max-w-lg mb-8 leading-relaxed">
						Discover the most innovative ML workflows shared by the community. Fork them to your workspace and start building instantly.
					</p>

					<div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
						<button 
							onClick={() => onFork(featuredPipeline)}
							className="group flex items-center gap-3 px-8 py-4 bg-foreground text-background rounded-2xl font-black uppercase text-sm hover:bg-amber-400 hover:text-black transition-all shadow-2xl hover:scale-105 active:scale-95"
						>
							<GitFork size={18} /> Fork This Pipeline
						</button>
						<Link 
							href={`/canvas/${featuredPipeline.id}?access=view`}
							className="group flex items-center gap-2 px-8 py-4 bg-foreground/5 border border-foreground/10 rounded-2xl font-black uppercase text-sm hover:bg-foreground/10 transition-all"
						>
							View Snapshot <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
						</Link>
					</div>
				</div>

				{/* Featured Card */}
				<div className="flex-1 w-full max-w-xl group">
					<div className="relative bg-background/40 backdrop-blur-3xl border border-foreground/10 rounded-4xl p-6 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] transition-all group-hover:scale-[1.02] group-hover:border-amber-400/30 text-left">
						<div className="absolute -inset-0.5 bg-gradient-to-br from-amber-400/20 to-purple-500/20 rounded-4xl opacity-0 group-hover:opacity-100 transition-opacity blur" />
						<div className="relative">
							{/* Large Thumbnail */}
							<div className="h-64 mb-6 rounded-2xl overflow-hidden grayscale-[0.5] group-hover:grayscale-0 transition-all duration-700">
								<PipelineThumbnail nodes={featuredPipeline.nodes} edges={featuredPipeline.edges} />
							</div>

							<div className="flex items-start justify-between">
								<div>
									<h2 className="text-2xl font-black tracking-tight mb-2 group-hover:text-amber-400 transition-colors">
										{featuredPipeline.name}
									</h2>
									<div className="flex items-center gap-2 mb-4">
										{featuredPipeline.profiles?.avatar_url ? (
											<img src={featuredPipeline.profiles.avatar_url} alt="" className="w-6 h-6 rounded-full border border-foreground/10" />
										) : (
											<div className="w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center"><Users size={12} /></div>
										)}
										<span className="text-xs text-foreground/50 font-bold uppercase tracking-wider">
											by <span className="text-foreground">{featuredPipeline.profiles?.username || 'Anonymous'}</span>
										</span>
									</div>
								</div>
								<div className="flex flex-col items-end gap-2 text-xs font-black">
									<div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
										<Heart size={14} className="fill-red-500" /> {featuredPipeline.likes_count || 0}
									</div>
									<div className="px-3 py-1 rounded-full bg-foreground/5 text-foreground/40 border border-foreground/10">
										v{featuredPipeline.version || 1}
									</div>
								</div>
							</div>
							
							<p className="text-sm text-foreground/50 line-clamp-2 leading-relaxed">
								{featuredPipeline.description || 'A powerful community-driven pipeline architecture for modern ML workflows.'}
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default CommunityHero
