'use client'

import React, { useState, useEffect } from 'react'
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
	Instagram
} from 'lucide-react'
import Link from 'next/link'
import ProfileSkeleton from '@/components/profile/ProfileSkeleton'
import ProfileWorkflowCard from '@/components/profile/ProfileWorkflowCard'

export default function PublicProfilePage() {
	const { handle } = useParams()
	const [profile, setProfile] = useState(null)
	const [pipelines, setPipelines] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)
	
	const supabase = createClient()
	const router = useRouter()

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
		<div className="min-h-screen bg-background text-foreground selection:bg-amber-400/30 selection:text-amber-400 font-sans">

			<nav className="relative z-50 flex items-center justify-between px-8 h-16 border-b border-foreground/5 bg-background/40 backdrop-blur-xl">
				<Link href="/community" className="flex items-center gap-2 text-sm font-bold text-foreground/40 hover:text-foreground transition-all group">
					<ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
					Back to Community
				</Link>
				<div className="flex items-center gap-4">
					<Link href="/dashboard" className="text-xs font-black uppercase tracking-widest text-foreground/20 hover:text-foreground transition-colors">
						My Dashboard
					</Link>
				</div>
			</nav>

			<main className="relative z-10 max-w-7xl mx-auto px-8 py-16">
				<div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-20">
					
					{/* Left Column: Profile Card */}
					<aside className="space-y-10">
						<div className="space-y-6">
							{/* Large Avatar with Border */}
							<div className="relative inline-block">
								<div className="w-48 h-48 rounded-full border-4 border-foreground bg-background p-1 overflow-hidden shadow-2xl">
									{profile.avatar_url ? (
										<img 
											src={profile.avatar_url} 
											alt={profile.username} 
											className="w-full h-full object-cover rounded-full"
										/>
									) : (
										<div className="w-full h-full bg-foreground/5 rounded-full flex items-center justify-center">
											<span className="text-5xl font-black text-foreground/10">{profile.username?.[0]?.toUpperCase()}</span>
										</div>
									)}
								</div>
							</div>

							<div className="space-y-2">
								<h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
									{profile.username}
								</h1>
								<p className="text-xl font-bold text-amber-400">@{profile.handle}</p>
							</div>

							<p className="text-lg text-foreground/60 leading-relaxed max-w-sm">
								{profile.about || `Passionate about building innovative AI workflows and contributing to the ProtoML community.`}
							</p>

							{/* Social/Links */}
							<div className="space-y-4 pt-4">
								{profile.socials?.youtube && (
									<a href={profile.socials.youtube} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-foreground/40 hover:text-foreground transition-colors group">
										<LinkIcon size={18} className="group-hover:text-amber-400" />
										<span className="text-sm font-semibold">{profile.socials.youtube.replace('https://', '')}</span>
									</a>
								)}
								{profile.socials?.twitter && (
									<a href={`https://twitter.com/${profile.socials.twitter}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-foreground/40 hover:text-foreground transition-colors group">
										<Twitter size={18} className="group-hover:text-amber-400" />
										<span className="text-sm font-semibold">@{profile.socials.twitter}</span>
									</a>
								)}
								{profile.socials?.github && (
									<a href={`https://github.com/${profile.socials.github}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-foreground/40 hover:text-foreground transition-colors group">
										<Github size={18} className="group-hover:text-foreground" />
										<span className="text-sm font-semibold">github.com/{profile.socials.github}</span>
									</a>
								)}
								{profile.socials?.linkedin && (
									<a href={`https://linkedin.com/in/${profile.socials.linkedin}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-foreground/40 hover:text-foreground transition-colors group">
										<Linkedin size={18} className="group-hover:text-blue-500" />
										<span className="text-sm font-semibold">linkedin.com/in/{profile.socials.linkedin}</span>
									</a>
								)}
								{profile.socials?.instagram && (
									<a href={`https://instagram.com/${profile.socials.instagram}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-foreground/40 hover:text-foreground transition-colors group">
										<Instagram size={18} className="group-hover:text-pink-500" />
										<span className="text-sm font-semibold">instagram.com/{profile.socials.instagram}</span>
									</a>
								)}
							</div>
						</div>
					</aside>

					{/* Right Column: Workflows */}
					<section className="space-y-12">
						<header className="flex items-center justify-between pb-6 border-b border-foreground/5">
							<h2 className="text-2xl font-black tracking-tight flex items-center gap-4">
								<span className="text-amber-400">{pipelines.length}</span>
								Workflow Templates
							</h2>
							<Link href="/community" className="flex items-center gap-2 text-sm font-bold text-foreground/40 hover:text-foreground transition-colors cursor-pointer group">
								Browse community gallery
								<LayoutGrid size={16} className="group-hover:rotate-12 transition-transform" />
							</Link>
						</header>

						<div className="bg-white/2 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
							{pipelines.length > 0 ? (
								<div className="divide-y divide-white/5">
									{pipelines.map(pipeline => (
										<ProfileWorkflowCard key={pipeline.id} pipeline={pipeline} />
									))}
								</div>
							) : (
								<div className="p-20 text-center space-y-4">
									<div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
										<Search size={32} className="text-white/20" />
									</div>
									<h3 className="text-xl font-bold">No public workflows yet</h3>
									<p className="text-foreground/40 max-w-xs mx-auto text-sm">When {profile.username} publishes pipelines to the community, they will appear here.</p>
								</div>
							)}
						</div>
					</section>

				</div>
			</main>
		</div>
	)
}
