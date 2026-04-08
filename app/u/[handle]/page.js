'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { 
	Twitter, 
	Github, 
	Link as LinkIcon, 
	ArrowLeft, 
	Mail, 
	CheckCircle2, 
	LayoutGrid,
	Search,
	Loader2,
	Linkedin,
	Instagram,
	Share2,
	Trophy,
	TrendingUp,
	Users,
	Copy,
	Check,
	X,
	ArrowUpDown,
	Frown
} from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import ProfileSkeleton from '@/components/profile/ProfileSkeleton'
import ProfileWorkflowCard from '@/components/profile/ProfileWorkflowCard'

export default function PublicProfilePage() {
	const { handle } = useParams()
	const [profile, setProfile] = useState(null)
	const [pipelines, setPipelines] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)
	const [searchQuery, setSearchQuery] = useState('')
	const [sortBy, setSortBy] = useState('newest')
	const [isShareModalOpen, setIsShareModalOpen] = useState(false)
	const [copied, setCopied] = useState(false)
	
	const supabase = createClient()
	const router = useRouter()

	const stats = useMemo(() => {
		if (!pipelines.length) return { pipelines: 0, likes: 0, forks: 0 }
		return {
			pipelines: pipelines.length,
			likes: pipelines.reduce((acc, p) => acc + (p.likes_count || 0), 0),
			forks: pipelines.reduce((acc, p) => acc + (p.fork_count || 0), 0)
		}
	}, [pipelines])

	const filteredPipelines = useMemo(() => {
		return pipelines
			.filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase()))
			.sort((a, b) => {
				if (sortBy === 'newest') return new Date(b.updated_at) - new Date(a.updated_at)
				if (sortBy === 'likes') return (b.likes_count || 0) - (a.likes_count || 0)
				return 0
			})
	}, [pipelines, searchQuery, sortBy])

	const handleCopyLink = () => {
		navigator.clipboard.writeText(window.location.href)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	useEffect(() => {
		async function fetchProfileData() {
			try {
				setLoading(true)
				// Fetch Profile
				const { data: profileData, error: profileError } = await supabase
					.from('profiles')
					.select('*')
					.eq('handle', handle.toLowerCase())
					.single()

				if (profileError) throw new Error('Profile not found')
				setProfile(profileData)

				// Fetch Public Pipelines
				const { data: pipelineData, error: pipelineError } = await supabase
					.from('pipelines')
					.select('*')
					.eq('user_id', profileData.id)
					.eq('is_public', true)
					.order('updated_at', { ascending: false })

				if (pipelineError) throw pipelineError
				setPipelines(pipelineData || [])

			} catch (err) {
				console.error('Error fetching profile:', err)
				setError(err.message)
			} finally {
				setLoading(false)
			}
		}

		if (handle) fetchProfileData()
	}, [handle, supabase])

	if (loading) {
		return <ProfileSkeleton />
	}

	if (error || !profile) {
		return (
			<div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
				<h1 className="text-4xl font-black mb-4">404</h1>
				<p className="text-foreground/50 mb-8">{error || 'User not found'}</p>
				<Link href="/community" className="px-6 py-2 bg-foreground text-background font-bold rounded-full hover:bg-amber-400 hover:text-black transition-colors">
					Explore Community
				</Link>
			</div>
		)
	}

	return (
		<div className={`min-h-screen bg-background text-foreground selection:bg-amber-400/30 selection:text-amber-400 font-sans`}>
			<nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 h-16 border-b border-white/[0.04] bg-background/60 backdrop-blur-xl">
				<Link href="/community" className="flex items-center gap-2 text-sm font-bold text-foreground/40 hover:text-foreground transition-all group">
					<ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
					Back to Community
				</Link>
				<div className="flex items-center gap-4">
					<button 
						onClick={() => setIsShareModalOpen(true)}
						className="flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 border border-foreground/5 transition-all text-xs font-bold uppercase tracking-widest"
					>
						<Share2 size={14} />
						Share
					</button>
					<div className="w-px h-4 bg-foreground/10 mx-2" />
					<Link href="/dashboard" className="text-xs font-black uppercase tracking-widest text-foreground/20 hover:text-foreground transition-colors">
						My Dashboard
					</Link>
				</div>
			</nav>

			{/* Banner */}
			<div className={`h-[280px] w-full bg-gradient-to-br ${profile.banner_gradient || 'from-amber-400 to-orange-500'} relative`}>
				<div className="absolute inset-0 bg-black/20" />
			</div>

			<main className="relative z-10 max-w-7xl mx-auto px-8 -mt-24 pb-24">
				<div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-16">
					
					{/* Left Column: Profile Card */}
					<aside className="space-y-10">
						<div className="space-y-8">
							{/* Large Avatar with Magnetic Effect */}
							<motion.div 
								whileHover={{ scale: 1.02 }}
								className="relative inline-block"
							>
								<div className={`w-48 h-48 rounded-3xl border-4 border-background bg-background p-1.5 overflow-hidden shadow-2xl transition-shadow duration-500 shadow-amber-400/20`}>
									{profile.avatar_url ? (
										<img 
											src={profile.avatar_url} 
											alt={profile.username} 
											className="w-full h-full object-cover rounded-2xl"
										/>
									) : (
										<div className="w-full h-full bg-foreground/5 rounded-2xl flex items-center justify-center">
											<span className="text-5xl font-black text-foreground/10">{profile.username?.[0]?.toUpperCase()}</span>
										</div>
									)}
								</div>
								{stats.likes > 100 && (
									<div className={`absolute -bottom-2 -right-2 p-3 rounded-2xl bg-amber-400 shadow-lg text-white`}>
										<Trophy size={18} />
									</div>
								)}
							</motion.div>

							<div className="space-y-3">
								<h1 className="text-4xl font-black tracking-tight flex items-center gap-2">
									{profile.username}
									{stats.likes > 50 && <CheckCircle2 size={24} className="text-amber-400" />}
								</h1>
								<p className={`text-xl font-bold text-amber-400`}>@{profile.handle}</p>
							</div>

							<p className="text-lg text-foreground/60 leading-relaxed">
								{profile.about || `Passionate about building innovative AI workflows and contributing to the ProtoML community.`}
							</p>

							{/* Stats Row */}
							<div className="flex items-center gap-8 py-6 border-y border-foreground/5">
								<div className="text-center">
									<p className="text-2xl font-black">{stats.pipelines}</p>
									<p className="text-[10px] font-bold uppercase tracking-widest text-foreground/30">Pipelines</p>
								</div>
								<div className="text-center">
									<p className="text-2xl font-black">{stats.likes}</p>
									<p className="text-[10px] font-bold uppercase tracking-widest text-foreground/30">Likes</p>
								</div>
								<div className="text-center">
									<p className="text-2xl font-black">{stats.forks}</p>
									<p className="text-[10px] font-bold uppercase tracking-widest text-foreground/30">Forks</p>
								</div>
							</div>

							{/* Badges */}
							{stats.pipelines > 5 && (
								<div className="flex flex-wrap gap-2">
									<div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400/10 text-amber-400 text-[10px] font-black uppercase tracking-widest`}>
										<TrendingUp size={10} />
										Top Contributor
									</div>
									<div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/5 text-foreground/40 text-[10px] font-black uppercase tracking-widest">
										<Users size={10} />
										Early Adopter
									</div>
								</div>
							)}

							{/* Social/Links */}
							<div className="space-y-4 pt-2">
								{profile.socials?.twitter && (
									<a href={`https://twitter.com/${profile.socials.twitter}`} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 text-foreground/40 hover:text-amber-400 transition-colors group`}>
										<Twitter size={18} />
										<span className="text-sm font-semibold">@{profile.socials.twitter}</span>
									</a>
								)}
								{profile.socials?.github && (
									<a href={`https://github.com/${profile.socials.github}`} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 text-foreground/40 hover:text-amber-400 transition-colors group`}>
										<Github size={18} />
										<span className="text-sm font-semibold">github.com/{profile.socials.github}</span>
									</a>
								)}
								{profile.socials?.linkedin && (
									<a href={`https://linkedin.com/in/${profile.socials.linkedin}`} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 text-foreground/40 hover:text-amber-400 transition-colors group`}>
										<Linkedin size={18} />
										<span className="text-sm font-semibold">linkedin.com/in/{profile.socials.linkedin}</span>
									</a>
								)}
								{profile.socials?.instagram && (
									<a href={`https://instagram.com/${profile.socials.instagram}`} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 text-foreground/40 hover:text-amber-400 transition-colors group`}>
										<Instagram size={18} />
										<span className="text-sm font-semibold">instagram.com/{profile.socials.instagram}</span>
									</a>
								)}
							</div>
						</div>
					</aside>

					{/* Right Column: Workflows */}
					<section className="space-y-10 pt-8">
						<div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-foreground/5">
							<h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
								<span className="text-amber-400">{pipelines.length}</span>
								Workflows
							</h2>
							
							<div className="flex items-center gap-3">
								<div className="relative group">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/20 group-focus-within:text-foreground/50 transition-colors" size={16} />
									<input 
										type="text"
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										placeholder="Search workflows..."
										className={`pl-10 pr-4 py-2 border border-foreground/5 bg-foreground/3 focus:bg-foreground/5 rounded-2xl text-sm outline-none transition-all w-full md:w-64 font-semibold focus:border-amber-400/50`}
									/>
								</div>
								<div className="flex items-center p-1 rounded-2xl bg-foreground/5 border border-foreground/5">
									<button 
										onClick={() => setSortBy('newest')}
										className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'newest' ? `bg-background text-foreground shadow-sm` : 'text-foreground/30 hover:text-foreground/60'}`}
									>
										Newest
									</button>
									<button 
										onClick={() => setSortBy('likes')}
										className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'likes' ? `bg-background text-foreground shadow-sm` : 'text-foreground/30 hover:text-foreground/60'}`}
									>
										Trending
									</button>
								</div>
							</div>
						</div>

						<div className="bg-white/[0.02] border border-white/5 rounded-[32px] overflow-hidden shadow-2xl min-h-[400px]">
							{filteredPipelines.length > 0 ? (
								<div className="divide-y divide-white/[0.03]">
									{filteredPipelines.map(pipeline => (
										<ProfileWorkflowCard key={pipeline.id} pipeline={pipeline} />
									))}
								</div>
							) : (
								<div className="p-24 text-center space-y-6">
									<div className="relative inline-block">
										<div className="w-20 h-20 bg-foreground/5 rounded-3xl flex items-center justify-center mx-auto animate-pulse">
											<Search size={32} className="text-foreground/20" />
										</div>
										<motion.div 
											animate={{ y: [0, -4, 0] }}
											transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
											className="absolute -top-2 -right-2 text-foreground/30"
										>
											<ArrowUpDown size={16} />
										</motion.div>
									</div>
									<div className="space-y-2">
										<h3 className="text-xl font-bold">
											{searchQuery ? "No matching workflows" : "No workflows found"}
										</h3>
										<p className="text-foreground/40 max-w-xs mx-auto text-sm leading-relaxed">
											{searchQuery ? `Try adjusting your search for "${searchQuery}"` : `When ${profile.username} publishes pipelines to the community, they will appear here.`}
										</p>
									</div>
									{!searchQuery && (
										<div className="pt-4">
											<div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl border border-dashed border-foreground/10 text-foreground/20 text-xs font-bold uppercase tracking-widest">
												Empty Canvas
											</div>
										</div>
									)}
								</div>
							)}
						</div>
					</section>

				</div>
			</main>

			{/* Share Modal */}
			<AnimatePresence>
				{isShareModalOpen && (
					<div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
						<motion.div 
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={() => setIsShareModalOpen(false)}
							className="absolute inset-0 bg-black/60 backdrop-blur-sm"
						/>
						<motion.div 
							initial={{ scale: 0.9, opacity: 0, y: 20 }}
							animate={{ scale: 1, opacity: 1, y: 0 }}
							exit={{ scale: 0.9, opacity: 0, y: 20 }}
							className="relative w-full max-w-md bg-background border border-foreground/10 rounded-[32px] overflow-hidden shadow-2xl p-8"
						>
							<button 
								onClick={() => setIsShareModalOpen(false)}
								className="absolute top-6 right-6 p-2 rounded-xl hover:bg-foreground/5 text-foreground/30 hover:text-foreground transition-all"
							>
								<X size={20} />
							</button>

							<div className="text-center space-y-6">
								<div className="space-y-2 pt-4">
									<h2 className="text-2xl font-black">Share Profile</h2>
									<p className="text-foreground/50 text-sm">Scan with your camera or copy the link below.</p>
								</div>

								{/* QR Code */}
								<div className="bg-white p-6 rounded-[24px] inline-block shadow-lg mx-auto border-4 border-foreground/5">
									<img 
										src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
										alt="Profile QR Code"
										className="w-40 h-40"
									/>
								</div>

								<div className="space-y-3">
									<div className="flex items-center gap-2 p-3 bg-foreground/5 rounded-2xl border border-foreground/5">
										<p className="flex-1 text-left text-xs font-mono text-foreground/40 overflow-hidden text-ellipsis whitespace-nowrap px-2">
											{typeof window !== 'undefined' ? window.location.href : '/u/user'}
										</p>
										<button 
											onClick={handleCopyLink}
											className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${copied ? 'bg-emerald-500 text-white' : `bg-amber-400 text-white hover:opacity-90`}`}
										>
											{copied ? <Check size={14} /> : <Copy size={14} />}
											{copied ? 'Copied' : 'Copy'}
										</button>
									</div>
								</div>
							</div>
						</motion.div>
					</div>
				)}
			</AnimatePresence>
		</div>
	)
}
