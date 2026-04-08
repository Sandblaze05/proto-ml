'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Camera, Check, User, Github, Twitter, Save, X, Linkedin, Instagram } from 'lucide-react'
import PrivateProfileSkeleton from '@/components/profile/PrivateProfileSkeleton'

const GRADIENTS = [
	'from-amber-400 to-orange-500',
	'from-blue-400 to-indigo-500',
	'from-emerald-400 to-teal-500',
	'from-pink-400 to-rose-500',
	'from-purple-400 to-fuchsia-500',
	'from-gray-700 to-black',
]

export default function ProfilePage() {
	const [user, setUser] = useState(null)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [message, setMessage] = useState({ text: '', type: '' })

	const [username, setUsername] = useState('')
	const [handle, setHandle] = useState('')
	const [handleStatus, setHandleStatus] = useState({ state: 'idle', message: '' })
	const [about, setAbout] = useState('')
	const [avatarUrl, setAvatarUrl] = useState('')
	const [bannerGradient, setBannerGradient] = useState(GRADIENTS[0])
	const [socials, setSocials] = useState({ twitter: '', github: '', linkedin: '', instagram: '' })

	const router = useRouter()
	const supabase = createClient()

	useEffect(() => {
		async function fetchProfile() {
			const { data: { user } } = await supabase.auth.getUser()
			if (!user) { router.push('/'); return }
			setUser(user)

			const { data: profile } = await supabase
				.from('profiles')
				.select('*')
				.eq('id', user.id)
				.single()

			setUsername(profile?.username || user?.user_metadata?.full_name || user?.email?.split('@')[0] || '')
			setHandle(profile?.handle || '')
			setAbout(profile?.about || '')
			setAvatarUrl(profile?.avatar_url || user?.user_metadata?.avatar_url || '')
			setBannerGradient(profile?.banner_gradient || GRADIENTS[0])
			setSocials(profile?.socials || { twitter: '', github: '', linkedin: '', instagram: '' })
			setLoading(false)
		}
		fetchProfile()
	}, [supabase, router])

	useEffect(() => {
		if (!handle || !user) {
			setHandleStatus({ state: 'idle', message: '' })
			return
		}
		
		const validate = async () => {
			const normalized = handle.toLowerCase().trim()
			
			if (normalized.length < 3) {
				setHandleStatus({ state: 'invalid', message: 'Too short (min 3 chars)' })
				return
			}
			if (!/^[a-z0-9_]+$/.test(normalized)) {
				setHandleStatus({ state: 'invalid', message: 'Only lowercase letters, numbers, and underscores allowed' })
				return
			}

			setHandleStatus({ state: 'checking', message: 'Checking...' })
			
			const { data, error } = await supabase
				.from('profiles')
				.select('id')
				.eq('handle', normalized)
				.neq('id', user.id)
				.maybeSingle()
				
			if (data) {
				setHandleStatus({ state: 'taken', message: 'Handle is already taken' })
			} else {
				setHandleStatus({ state: 'available', message: 'Handle is available' })
			}
		}

		const timer = setTimeout(validate, 400)
		return () => clearTimeout(timer)
	}, [handle, user, supabase])

	const handleImageUpload = (e) => {
		const file = e.target.files?.[0]
		if (!file) return
		if (file.size > 2 * 1024 * 1024) {
			setMessage({ text: 'Image too large. Max 2MB.', type: 'error' })
			return
		}
		const reader = new FileReader()
		reader.onloadend = () => setAvatarUrl(reader.result)
		reader.readAsDataURL(file)
	}

	const stripUsername = (value, platform) => {
		if (!value) return ''
		const platformPatterns = {
			github: /github\.com\/([^/?#]+)/i,
			twitter: /(?:x|twitter)\.com\/([^/?#]+)/i,
			linkedin: /linkedin\.com\/in\/([^/?#]+)/i,
			instagram: /instagram\.com\/([^/?#]+)/i
		}
		const pattern = platformPatterns[platform]
		if (pattern) {
			const match = value.match(pattern)
			if (match) return match[1]
		}
		// Handle cases like "@username"
		if (value.startsWith('@') && platform !== 'linkedin') return value.slice(1)
		return value
	}

	const handleSocialChange = (platform, value) => {
		const clean = stripUsername(value, platform)
		setSocials(prev => ({ ...prev, [platform]: clean }))
	}

	const saveProfile = async () => {
		if (!user) return
		setSaving(true)
		setMessage({ text: '', type: '' })
		try {
			if (handleStatus.state === 'taken' || handleStatus.state === 'invalid') {
				throw new Error(handleStatus.message || 'Invalid handle')
			}

			const { error } = await supabase.from('profiles').upsert({
				id: user.id,
				username: username.trim(),
				handle: handle.toLowerCase().trim(),
				about: about.trim(),
				avatar_url: avatarUrl,
				banner_gradient: bannerGradient,
				socials,
				updated_at: new Date().toISOString()
			})
			if (error) throw error
			setMessage({ text: 'Saved.', type: 'success' })
			await supabase.auth.updateUser({ data: { full_name: username.trim() } })
		} catch (err) {
			setMessage({ text: err.message || 'Failed to save', type: 'error' })
		} finally {
			setSaving(false)
		}
	}

	if (loading) {
		return <PrivateProfileSkeleton />
	}

	return (
		<div className="min-h-screen bg-background text-foreground">
			{/* Navbar */}
			<nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-14 border-b border-foreground/[0.06] bg-background/90 backdrop-blur-sm">
				<Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold text-foreground/50 hover:text-foreground transition-colors group">
					<ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
					Dashboard
				</Link>
				<span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/25">Profile Settings</span>
				<div className="w-24" />
			</nav>

			<main className="pt-14 min-h-screen">
				<div className="max-w-5xl mx-auto px-6 py-12">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">

						{/* LEFT — Live Preview (sticky) */}
						<div className="lg:sticky lg:top-24 lg:self-start order-2 lg:order-1">
							<p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/20 mb-3">Live preview</p>

							<div className="rounded-2xl overflow-hidden border border-foreground/[0.08] shadow-lg">
								{/* Banner — clean gradient only */}
								<div className={`h-28 w-full bg-gradient-to-br ${bannerGradient} transition-all duration-500`} />

								<div className="bg-foreground/[0.02] px-6 pb-5">
									{/* Avatar */}
									<div className="relative -mt-8 mb-4 inline-block group">
										<div className="w-16 h-16 rounded-xl border-[3px] border-background bg-foreground/[0.08] overflow-hidden shadow-md relative">
											{avatarUrl ? (
												<img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
											) : (
												<div className="w-full h-full flex items-center justify-center">
													<User size={26} strokeWidth={1.5} className="text-foreground/30" />
												</div>
											)}
											<label className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
												<Camera size={13} className="text-white mb-0.5" />
												<span className="text-[8px] font-bold text-white uppercase tracking-widest">Change</span>
												<input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
											</label>
										</div>
										{avatarUrl && (
											<button
												onClick={() => setAvatarUrl('')}
												title="Remove photo"
												className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-background border border-foreground/20 flex items-center justify-center hover:border-red-400/60 hover:text-red-400 text-foreground/40 transition-colors shadow-sm"
											>
												<X size={10} />
											</button>
										)}
									</div>

									<h1 className="text-lg font-black tracking-tight leading-none mb-0.5">
										{username || <span className="text-foreground/20">Anonymous</span>}
									</h1>
									{handle && <p className="text-xs text-amber-400 font-bold mb-3 tracking-tight">@{handle.toLowerCase()}</p>}

									{about ? (
										<p className="text-sm text-foreground/60 leading-relaxed border-l-2 border-amber-400/50 pl-3 mb-4">
											{about}
										</p>
									) : (
										<p className="text-xs text-foreground/20 italic mb-4">Your bio will appear here...</p>
									)}

									<div className="flex flex-col gap-2">
										{socials.github && (
											<div className="flex items-center gap-1.5 text-xs text-foreground/40">
												<Github size={11} /><span className="font-mono">{socials.github}</span>
											</div>
										)}
										{socials.twitter && (
											<div className="flex items-center gap-1.5 text-xs text-foreground/40">
												<Twitter size={11} /><span className="font-mono">{socials.twitter}</span>
											</div>
										)}
										{socials.linkedin && (
											<div className="flex items-center gap-1.5 text-xs text-foreground/40">
												<Linkedin size={11} /><span className="font-mono">{socials.linkedin}</span>
											</div>
										)}
										{socials.instagram && (
											<div className="flex items-center gap-1.5 text-xs text-foreground/40">
												<Instagram size={11} /><span className="font-mono">{socials.instagram}</span>
											</div>
										)}
									</div>
								</div>

								{/* Banner color picker — below profile content */}
								<div className="px-6 py-4 border-t border-foreground/[0.06] bg-foreground/[0.01]">
									<p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/25 mb-3">Banner gradient</p>
									<div className="flex gap-2 flex-wrap">
										{GRADIENTS.map((grad, idx) => (
											<button
												key={idx}
												onClick={() => setBannerGradient(grad)}
												title={`Color ${idx + 1}`}
												className={`w-8 h-8 rounded-lg bg-gradient-to-br ${grad} relative transition-all duration-150 hover:scale-110 active:scale-95 shrink-0 ${
													bannerGradient === grad
														? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-background scale-110'
														: 'opacity-50 hover:opacity-90'
												}`}
											>
												{bannerGradient === grad && (
													<div className="absolute inset-0 flex items-center justify-center">
														<Check size={11} className="text-white drop-shadow" />
													</div>
												)}
											</button>
										))}
									</div>
								</div>
							</div>
						</div>

						{/* RIGHT — Editor */}
						<div className="space-y-10 order-1 lg:order-2">

							{/* 01 Identity */}
							<section>
								<div className="flex items-center gap-3 mb-5">
									<span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/25">01</span>
									<h2 className="text-xs font-bold text-foreground/50 uppercase tracking-wider">Identity</h2>
									<div className="flex-1 h-px bg-foreground/[0.07]" />
								</div>
								<div className="space-y-4">
									<div>
										<label className="block text-[10px] font-bold text-foreground/35 mb-2 uppercase tracking-widest">Display Name</label>
										<input
											type="text"
											value={username}
											onChange={(e) => setUsername(e.target.value)}
											className="w-full bg-foreground/4 border border-foreground/8 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-amber-400/50 focus:bg-foreground/6 transition-all placeholder:text-foreground/20"
											placeholder="Derek Cheung"
										/>
										<p className="text-[10px] text-foreground/25 mt-1.5">Your full name or a nickname.</p>
									</div>
									<div>
										<label className="block text-[10px] font-bold text-foreground/35 mb-2 uppercase tracking-widest">Unique Handle</label>
										<div className="relative">
											<span className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/30 font-bold text-sm">@</span>
											<input
												type="text"
												value={handle}
												onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/\s/g, ''))}
												className={`w-full bg-foreground/4 border rounded-xl pl-8 pr-4 py-3 text-sm font-bold outline-none transition-all placeholder:text-foreground/10 ${
													handleStatus.state === 'available' ? 'border-emerald-500/30 focus:border-emerald-500/50' :
													handleStatus.state === 'taken' || handleStatus.state === 'invalid' ? 'border-red-500/30 focus:border-red-500/50' :
													'border-foreground/8 focus:border-amber-400/50'
												}`}
												placeholder="username"
											/>
										</div>
										{handleStatus.message && (
											<p className={`text-[10px] font-bold mt-1.5 uppercase tracking-wide ${
												handleStatus.state === 'available' ? 'text-emerald-500' : 
												handleStatus.state === 'checking' ? 'text-amber-400/50' : 'text-red-500'
											}`}>
												{handleStatus.message}
											</p>
										)}
										<p className="text-[10px] text-foreground/25 mt-1.5 uppercase tracking-widest">This is your unique URL: proto-ml.com/u/{handle || '...'}</p>
									</div>
									<div>
										<label className="block text-[10px] font-bold text-foreground/35 mb-2 uppercase tracking-widest">Bio</label>
										<textarea
											value={about}
											onChange={(e) => setAbout(e.target.value)}
											className="w-full bg-foreground/4 border border-foreground/8 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-400/50 focus:bg-foreground/6 transition-all resize-none h-[88px] placeholder:text-foreground/20 leading-relaxed"
											placeholder="A short bio for the community..."
										/>
									</div>
								</div>
							</section>

							{/* 02 Socials */}
							<section>
								<div className="flex items-center gap-3 mb-5">
									<span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/25">02</span>
									<h2 className="text-xs font-bold text-foreground/50 uppercase tracking-wider">Socials</h2>
									<div className="flex-1 h-px bg-foreground/[0.07]" />
								</div>
								<div className="space-y-3">
									<div className="flex items-center gap-3 bg-foreground/4 border border-foreground/8 rounded-xl px-4 py-3 focus-within:border-amber-400/50 transition-all">
										<Github size={14} className="text-foreground/30 shrink-0" />
										<span className="text-foreground/25 text-xs font-mono shrink-0">github.com/</span>
										<input
											type="text"
											value={socials.github || ''}
											onChange={(e) => handleSocialChange('github', e.target.value)}
											className="flex-1 bg-transparent text-sm outline-none font-mono placeholder:text-foreground/20 min-w-0"
											placeholder="your-handle"
										/>
									</div>
									<div className="flex items-center gap-3 bg-foreground/4 border border-foreground/8 rounded-xl px-4 py-3 focus-within:border-amber-400/50 transition-all">
										<Twitter size={14} className="text-foreground/30 shrink-0" />
										<span className="text-foreground/25 text-xs font-mono shrink-0">x.com/</span>
										<input
											type="text"
											value={socials.twitter || ''}
											onChange={(e) => handleSocialChange('twitter', e.target.value)}
											className="flex-1 bg-transparent text-sm outline-none font-mono placeholder:text-foreground/20 min-w-0"
											placeholder="your-handle"
										/>
									</div>
									<div className="flex items-center gap-3 bg-foreground/4 border border-foreground/8 rounded-xl px-4 py-3 focus-within:border-amber-400/50 transition-all">
										<Linkedin size={14} className="text-foreground/30 shrink-0" />
										<span className="text-foreground/25 text-xs font-mono shrink-0">linkedin.com/in/</span>
										<input
											type="text"
											value={socials.linkedin || ''}
											onChange={(e) => handleSocialChange('linkedin', e.target.value)}
											className="flex-1 bg-transparent text-sm outline-none font-mono placeholder:text-foreground/20 min-w-0"
											placeholder="your-id"
										/>
									</div>
									<div className="flex items-center gap-3 bg-foreground/4 border border-foreground/8 rounded-xl px-4 py-3 focus-within:border-amber-400/50 transition-all">
										<Instagram size={14} className="text-foreground/30 shrink-0" />
										<span className="text-foreground/25 text-xs font-mono shrink-0">instagram.com/</span>
										<input
											type="text"
											value={socials.instagram || ''}
											onChange={(e) => handleSocialChange('instagram', e.target.value)}
											className="flex-1 bg-transparent text-sm outline-none font-mono placeholder:text-foreground/20 min-w-0"
											placeholder="your-handle"
										/>
									</div>
								</div>
							</section>

							{/* Save */}
							<div className="flex items-center gap-4 pt-1">
								<button
									onClick={saveProfile}
									disabled={saving}
									className="flex items-center gap-2 px-6 py-3 bg-foreground text-background text-sm font-black rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
								>
									<Save size={14} />
									{saving ? 'Saving...' : 'Save changes'}
								</button>
								{message.text && (
									<span className={`text-xs font-semibold animate-in fade-in slide-in-from-left-2 duration-200 ${
										message.type === 'error' ? 'text-red-400' : 'text-emerald-400'
									}`}>
										{message.text}
									</span>
								)}
							</div>
						</div>

					</div>
				</div>
			</main>
		</div>
	)
}