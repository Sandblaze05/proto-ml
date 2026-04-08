'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Heart, Clock, Users, ArrowRight, Grid, Filter, SortDesc, Copy, GitFork, Check } from 'lucide-react'
import Link from 'next/link'
import PipelineThumbnail from '@/components/PipelineThumbnail'
import { forkPipeline } from '@/lib/community'
import { useUIStore } from '@/store/useUIStore'
import CommunityHero from '@/components/community/CommunityHero'
import CategoryBar, { CATEGORIES } from '@/components/community/CategoryBar'
import CommunitySkeleton from '@/components/community/CommunitySkeleton'
import CustomDropdown from '@/components/ui/CustomDropdown'

const CommunityPage = () => {
	const [pipelines, setPipelines] = useState([])
	const [loading, setLoading] = useState(true)
	const [searchQuery, setSearchQuery] = useState('')
	const [sortBy, setSortBy] = useState('updated_at') // or 'likes_count'
	const [likedPipelines, setLikedPipelines] = useState(new Set())
	const [forkedIds, setForkedIds] = useState(new Set())
	const [selectedCategory, setSelectedCategory] = useState('all')
	
	const communitySortOptions = [
		{ value: 'updated_at', label: 'Most Recent', icon: Clock },
		{ value: 'likes_count', label: 'Most Liked', icon: Heart },
	]

	const { addToast } = useUIStore()
	const supabase = createClient()

	useEffect(() => {
		const fetchCommunityPipelines = async () => {
			const { data, error } = await supabase
				.from('pipelines')
				.select('*, profiles(username, avatar_url, handle)')
				.eq('is_public', true)
				.eq('is_snapshot', true)
				.order(sortBy, { ascending: false })
				
			if (error) {
				console.error('Error fetching community pipelines:', error)
			} else {
				setPipelines(data || [])
			}

			// Fetch user likes
			const { data: { user } } = await supabase.auth.getUser()
			if (user) {
				const { data: likes } = await supabase
					.from('pipeline_likes')
					.select('pipeline_id')
					.eq('user_id', user.id)
				if (likes) {
					setLikedPipelines(new Set(likes.map(l => l.pipeline_id)))
				}
			}
			setLoading(false)
		}
		
		fetchCommunityPipelines()
	}, [supabase, sortBy])

	const handleForkPipeline = async (e, pipeline) => {
		e.preventDefault()
		e.stopPropagation()
		
		const { data: { user } } = await supabase.auth.getUser()
		if (!user) {
			addToast('You must be logged in to fork pipelines.', 'error')
			return
		}

		try {
			await forkPipeline(supabase, user.id, pipeline)
			setForkedIds(prev => new Set([...prev, pipeline.id]))
			addToast('Pipeline forked successfully! Check your dashboard.', 'success')
		} catch (err) {
			console.error('Fork operation failed:', err);
			console.error('Fork error stringified:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
			addToast(`Error: ${err.message || 'Failed to fork pipeline.'}`, 'error');
		}
	}

	const handleLike = async (e, pipeline) => {
		e.preventDefault()
		e.stopPropagation()

		const { data: { user } } = await supabase.auth.getUser()
		if (!user) {
			addToast('You must be logged in to like pipelines.', 'error')
			return
		}

		const isLiked = likedPipelines.has(pipeline.id)
		
		// Optimistic UI update
		const adjust = isLiked ? -1 : 1
		const newLikes = Math.max(0, (pipeline.likes_count || 0) + adjust)
		
		setPipelines(current => current.map(p => 
			p.id === pipeline.id ? { ...p, likes_count: newLikes } : p
		))
		
		setLikedPipelines(prev => {
			const next = new Set(prev)
			if (isLiked) next.delete(pipeline.id)
			else next.add(pipeline.id)
			return next
		})

		try {
			if (isLiked) {
				// Unlike
				const { error } = await supabase
					.from('pipeline_likes')
					.delete()
					.eq('user_id', user.id)
					.eq('pipeline_id', pipeline.id)
				if (error) throw error

				// Decrement total count via RPC
				const { error: rpcError } = await supabase.rpc('adjust_likes_count', { 
					pipeline_id: pipeline.id, 
					adjustment: -1 
				})
				if (rpcError) throw rpcError
				addToast('Removed from favorites', 'info')
			} else {
				// Like
				const { error } = await supabase
					.from('pipeline_likes')
					.insert({ user_id: user.id, pipeline_id: pipeline.id })
				if (error) throw error

				// Increment total count via RPC
				const { error: rpcError } = await supabase.rpc('adjust_likes_count', { 
					pipeline_id: pipeline.id, 
					adjustment: 1 
				})
				if (rpcError) throw rpcError
				addToast('Added to your favorites!', 'success')
			}
				
		} catch (err) {
			console.error('Like error:', err)
			// Revert UI optimistically
			setPipelines(current => current.map(p => 
				p.id === pipeline.id ? { ...p, likes_count: pipeline.likes_count } : p
			))
			setLikedPipelines(prev => {
				const next = new Set(prev)
				if (isLiked) next.add(pipeline.id)
				else next.delete(pipeline.id)
				return next
			})
		}
	}

	const filteredPipelines = pipelines.filter(p => {
		const matchesSearch = (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
			(p.description || '').toLowerCase().includes(searchQuery.toLowerCase())
		
		const activeCategory = CATEGORIES.find(c => c.id === selectedCategory)
		const matchesCategory = selectedCategory === 'all' || 
			(p.tags && p.tags.some(tag => tag.toLowerCase() === activeCategory?.tag?.toLowerCase()))
			
		return matchesSearch && matchesCategory
	})

	const featuredPipeline = pipelines.reduce((max, p) => (p.likes_count > (max?.likes_count || 0)) ? p : max, null)

	return (
		<div className="min-h-screen bg-background text-foreground font-mono p-8">
			<div className="max-w-6xl mx-auto">
				<header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-4">
					<div>
						<h1 className="text-4xl font-bold tracking-tighter uppercase flex items-center gap-3">
							<Users className="text-amber-400" size={36} /> Community
						</h1>
						<p className="text-foreground/50 text-sm mt-2">Discover, clone, and remix pipelines built by the community</p>
					</div>
					<Link
						href="/dashboard"
						className="px-6 py-2 border border-foreground/20 text-foreground font-bold rounded-full hover:bg-foreground/5 transition-all text-sm"
					>
						Back to Dashboard
					</Link>
				</header>

				{/* Hero Section */}
				{!loading && pipelines.length > 0 && selectedCategory === 'all' && !searchQuery && (
					<CommunityHero 
						featuredPipeline={featuredPipeline} 
						onFork={(p) => handleForkPipeline({ preventDefault: () => {}, stopPropagation: () => {} }, p)} 
					/>
				)}

				<CategoryBar 
					selectedCategory={selectedCategory} 
					onSelect={setSelectedCategory} 
				/>

				{/* Search and Filter */}
				<div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-foreground/5 p-4 rounded-2xl border border-foreground/10">
					<div className="relative w-full md:w-1/2">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" size={18} />
						<input
							type="text"
							placeholder="Search pipelines..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full bg-background border border-foreground/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:border-foreground/30 outline-none transition-all"
						/>
					</div>

					<div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
						<div className="flex items-center gap-2 text-foreground/40 text-[10px] font-black uppercase tracking-widest mr-2">
							<SortDesc size={14} /> Sort By
						</div>
						<CustomDropdown 
							value={sortBy} 
							onChange={setSortBy} 
							options={communitySortOptions} 
							variant="pill"
							label="Community Sorting"
						/>
					</div>
				</div>

				{/* Grid */}
				{loading ? (
					<CommunitySkeleton />
				) : filteredPipelines.length === 0 ? (
					<div className="text-center py-20 border border-dashed border-foreground/10 rounded-3xl bg-foreground/2">
						<Users size={48} className="mx-auto text-foreground/20 mb-4" />
						<p className="text-lg font-bold">No public pipelines found.</p>
						<p className="text-sm text-foreground/50">Be the first to publish a pipeline to the community!</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{filteredPipelines.map(p => (
							<div key={p.id} className="group bg-foreground/5 border border-foreground/10 rounded-2xl hover:border-foreground/30 hover:shadow-xl transition-all p-6 flex flex-col h-full relative cursor-pointer">
								<PipelineThumbnail nodes={p.nodes} edges={p.edges} />
								<div className="mt-4 flex-1">
									<div className="flex items-start justify-between gap-2">
										<h3 className="text-xl font-bold truncate pr-4 text-foreground group-hover:text-amber-400 transition-colors duration-300">{p.name || 'Untitled Pipeline'}</h3>
										<span className="flex-shrink-0 bg-amber-400/10 text-amber-500 border border-amber-400/20 px-1.5 py-0.5 rounded text-[9px] font-black uppercase">v{p.version || 1}</span>
									</div>
									<Link 
										href={`/u/${p.profiles?.handle || p.profiles?.username || p.author_name}`} 
										className="flex items-center gap-2 mt-2 hover:opacity-70 transition-opacity relative z-20"
									>
										{p.profiles?.avatar_url ? (
											<img src={p.profiles.avatar_url} alt={p.profiles.username} className="w-5 h-5 rounded-full object-cover border border-foreground/10" />
										) : (
											<div className="w-5 h-5 rounded-full bg-foreground/10 flex items-center justify-center">
												<Users size={10} className="text-foreground/40" />
											</div>
										)}
										<p className="text-[10px] text-foreground/60 uppercase tracking-wider">by <span className="font-bold text-foreground underline-offset-2 group-hover:underline decoration-amber-400/50">{p.profiles?.username || p.author_name || 'Anonymous'}</span></p>
									</Link>
									<p className="text-xs text-foreground/50 line-clamp-2 mt-2 leading-relaxed">
										{p.description || 'No description provided.'}
									</p>
									{p.tags && p.tags.length > 0 && (
										<div className="flex flex-wrap gap-2 mt-3">
											{p.tags.slice(0, 3).map((tag, idx) => (
												<span key={idx} className="bg-foreground/10 px-2 py-0.5 rounded text-[10px] font-bold text-foreground/70 uppercase tracking-wider">
													{tag}
												</span>
											))}
											{p.tags.length > 3 && <span className="text-[10px] text-foreground/40 font-bold flex items-center">+{p.tags.length - 3}</span>}
										</div>
									)}
								</div>
								
								<div className="mt-6 flex items-center justify-between border-t border-foreground/10 pt-4">
									<div className="flex items-center gap-4 text-xs font-bold text-foreground/50">
										<button onClick={(e) => handleLike(e, p)} className={`flex items-center gap-1 transition-all z-20 cursor-pointer hover:scale-105 active:scale-95 ${likedPipelines.has(p.id) ? 'text-red-500' : 'hover:text-red-400 focus:text-red-500'}`}>
											<Heart size={14} className={likedPipelines.has(p.id) ? 'fill-red-500' : ''} /> {p.likes_count || 0}
										</button>
										<div className="flex items-center gap-1" title="Number of forks">
											<GitFork size={14} /> {p.fork_count || 0}
										</div>
										<div className="flex items-center gap-1">
											<Clock size={14} /> {new Date(p.updated_at).toLocaleDateString()}
										</div>
									</div>
									<div className="flex items-center gap-3 relative z-20">
										<button 
											onClick={(e) => handleForkPipeline(e, p)}
											disabled={forkedIds.has(p.id)}
											className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-lg active:scale-95 uppercase tracking-tighter ${forkedIds.has(p.id) ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 cursor-default' : 'bg-foreground text-background hover:bg-amber-400 hover:text-black cursors-pointer'}`}
											title={forkedIds.has(p.id) ? "Already forked to your dashboard" : "Fork to your dashboard to edit and run"}
										>
											{forkedIds.has(p.id) ? (
												<><Check size={14} /> Forked</>
											) : (
												<><GitFork size={14} /> Fork</>
											)}
										</button>
									</div>
								</div>
								
								<Link
									href={`/canvas/${p.id}?access=view`}
									className="absolute inset-0 z-10"
								/>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}

export default CommunityPage
