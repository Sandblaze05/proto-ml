'use client'

import React, { useState, useEffect, useRef } from 'react'
import { toPng } from 'html-to-image'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Camera, Check, User, Github, Twitter, Save, X, Linkedin, Instagram, Eye, Users, Sparkles, Share2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import PrivateProfileSkeleton from '@/components/profile/PrivateProfileSkeleton'
import ImageCropModal from '@/components/profile/ImageCropModal'
import AdmitOneTicket, { TICKET_STYLE, remixTicketStyle, playShutterSound } from '@/components/profile/AdmitOneTicket'

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
	const [avatarBlob, setAvatarBlob] = useState(null)
	const [bannerGradient, setBannerGradient] = useState(GRADIENTS[0])
	const [socials, setSocials] = useState({ twitter: '', github: '', linkedin: '', instagram: '' })
	const [imageToCrop, setImageToCrop] = useState(null)
	const [showCropModal, setShowCropModal] = useState(false)

	const [ticketStyle, setTicketStyle] = useState(TICKET_STYLE)
	const [ticketWidth, setTicketWidth] = useState(440)
	const [isDesktop, setIsDesktop] = useState(false)
	const ticketContainerRef = useRef(null)
	const ticketStyleStorageKey = user?.id ? `proto-ml-ticket-style:${user.id}` : null

	useEffect(() => {
		if (!ticketContainerRef.current) return
		const ro = new ResizeObserver(([entry]) => {
			if (entry?.contentRect?.width) {
				setTicketWidth(Math.floor(entry.contentRect.width))
			}
		})
		ro.observe(ticketContainerRef.current)
		return () => ro.disconnect()
	}, [])

	useEffect(() => {
		const mediaQuery = window.matchMedia('(min-width: 1024px)')
		const updateDesktopState = () => setIsDesktop(mediaQuery.matches)
		updateDesktopState()
		mediaQuery.addEventListener('change', updateDesktopState)
		return () => mediaQuery.removeEventListener('change', updateDesktopState)
	}, [])

	const handleRemixTicket = () => {
		playShutterSound()
		setTicketStyle(prev => {
			const nextStyle = remixTicketStyle(prev)
			if (ticketStyleStorageKey) {
				localStorage.setItem(ticketStyleStorageKey, JSON.stringify(nextStyle))
			}
			return nextStyle
		})
	}

	const handleShareProfile = async () => {
		if (!handle) {
			setMessage({ text: 'Add a handle before sharing your profile.', type: 'error' })
			return
		}

		const profileUrl = `${window.location.origin}/u/${handle}`
		try {
			await new Promise(requestAnimationFrame)
			const cardDataUrl = await toPng(ticketContainerRef.current, {
				cacheBust: true,
				pixelRatio: 2,
				skipFonts: true
			})
			const response = await fetch(cardDataUrl)
			const cardBlob = await response.blob()
			const cardFile = new File([cardBlob], `${handle}-admit-card.png`, { type: 'image/png' })

			if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [cardFile] }))) {
				await navigator.share({
					title: `${username || 'Profile'} | PROTO-ML`,
					text: `View ${username || 'my'} PROTO-ML profile`,
					files: [cardFile]
				})
			} else {
				const downloadLink = document.createElement('a')
				downloadLink.href = cardDataUrl
				downloadLink.download = cardFile.name
				downloadLink.click()
				setMessage({ text: 'Admit card PNG downloaded.', type: 'success' })
			}
		} catch (error) {
			if (error?.name !== 'AbortError') {
				setMessage({ text: 'Unable to share profile link.', type: 'error' })
			}
		}
	}

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
		if (!ticketStyleStorageKey) return
		try {
			const storedStyle = localStorage.getItem(ticketStyleStorageKey)
			if (storedStyle) setTicketStyle(JSON.parse(storedStyle))
		} catch (error) {
			console.warn('Unable to restore ticket design:', error)
		}
	}, [ticketStyleStorageKey])

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

		// Read file as data URL to pass to cropper
		const reader = new FileReader()
		reader.onload = () => {
			setImageToCrop(reader.result)
			setShowCropModal(true)
		}
		reader.readAsDataURL(file)
	}

	const handleCropComplete = async (croppedImage) => {
		try {
			// Instant UI update
			setAvatarUrl(croppedImage)
			
			// Store the blob for later upload
			const response = await fetch(croppedImage)
			const blob = await response.blob()
			setAvatarBlob(blob)
			
			setShowCropModal(false)
			setMessage({ text: 'Avatar adjusted. Remember to save changes.', type: 'success' })
		} catch (err) {
			console.error('Crop error:', err)
			setMessage({ text: 'Failed to process image', type: 'error' })
		}
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

			let finalAvatarUrl = avatarUrl

			// Handle image upload if a new one was cropped
			if (avatarBlob) {
				const file = new File([avatarBlob], 'avatar.jpg', { type: 'image/jpeg' })
				const fileName = `${Math.random()}.jpg`
				const filePath = `${user.id}/${fileName}`

				const { error: uploadError } = await supabase.storage
					.from('avatars')
					.upload(filePath, file)

				if (uploadError) throw uploadError

				const { data: { publicUrl } } = supabase.storage
					.from('avatars')
					.getPublicUrl(filePath)
				
				finalAvatarUrl = publicUrl
				setAvatarUrl(publicUrl)
				setAvatarBlob(null)
			}

			const { error } = await supabase.from('profiles').upsert({
				id: user.id,
				username: username.trim(),
				handle: handle.toLowerCase().trim(),
				about: about.trim(),
				avatar_url: finalAvatarUrl,
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
			<nav className="sticky top-0 z-50 flex items-center justify-between px-6 h-14 border-b border-foreground/[0.06] bg-background/90 backdrop-blur-sm">
				<Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold text-foreground/50 hover:text-foreground transition-colors group">
					<ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
					Dashboard
				</Link>
				<span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/25">Profile Settings</span>
				<div className="w-24" />
			</nav>

			<main className="min-h-screen">
				<div className="w-full px-6 lg:px-10 xl:px-14 py-12">
					<div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-14 xl:gap-20">

						<div className="lg:sticky lg:top-24 lg:self-start order-1 lg:order-1 space-y-4">
							<div className="flex items-center justify-between">
								<div />
								<button
									type="button"
									onClick={handleRemixTicket}
									title="Shuffle pattern, colors and sound"
									className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400/10 border border-amber-400/25 text-amber-500 dark:text-amber-400 text-xs font-bold hover:bg-amber-400/20 active:scale-95 transition-all shadow-sm cursor-pointer"
								>
									<Sparkles size={12} />
									<span>Remix Pass</span>
								</button>
								<button
									type="button"
									onClick={handleShareProfile}
									title="Share profile"
									className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-foreground/5 border border-foreground/10 text-foreground/60 text-xs font-bold hover:bg-foreground/10 active:scale-95 transition-all cursor-pointer"
								>
									<Share2 size={12} />
									<span>Share</span>
								</button>
							</div>

							<div ref={ticketContainerRef} className="w-full flex justify-center py-2 overflow-visible">
								<AdmitOneTicket
									width={isDesktop ? 700 : ticketWidth}
									name={username || 'ANONYMOUS'}
									presenter={handle ? `@${handle.toUpperCase()}` : 'PROTO-ML'}
									event={about || 'MEMBER PASS'}
									venue="PROTO-ML"
									dates="MEMBER 2026"
									stubText="ADMIT ONE"
									qrValue={handle && typeof window !== 'undefined' ? `${window.location.origin}/u/${handle}` : ''}
									watermark={user?.id ? `NO ${user.id.slice(0, 4).toUpperCase()}` : 'NO 0741'}
									texture={ticketStyle.texture}
									gradient={ticketStyle.gradient}
								/>
							</div>
						</div>

						{/* RIGHT - Editor */}
						<div className="space-y-10 order-2 lg:order-2">

							{/* 01 Identity */}
							<section>
								<div className="flex items-center gap-3 mb-5">
									<span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/25">01</span>
									<h2 className="text-xs font-bold text-foreground/50 uppercase tracking-wider">Identity</h2>
									<div className="flex-1 h-px bg-foreground/[0.07]" />
								</div>
								<div className="space-y-4">
									<div className="flex items-center gap-4 p-3 rounded-2xl bg-foreground/3 border border-foreground/8">
										<div className="w-12 h-12 rounded-xl bg-foreground/8 overflow-hidden border border-foreground/10 flex items-center justify-center shrink-0 relative">
											{avatarUrl ? (
												<img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
											) : (
												<User size={20} className="text-foreground/30" />
											)}
										</div>
										<div className="flex-1 min-w-0">
											<p className="text-xs font-bold truncate">{username || 'Anonymous'}</p>
											<p className="text-[10px] text-foreground/40">Profile Avatar</p>
										</div>
										<label className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground/6 hover:bg-foreground/10 text-foreground text-xs font-semibold rounded-xl cursor-pointer transition-all active:scale-95">
											<Camera size={12} />
											<span>Change photo</span>
											<input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
										</label>
									</div>
									<div>
										<label className="block text-[10px] font-bold text-foreground/35 mb-2 uppercase tracking-widest">Display Name</label>
										<input
											type="text"
											value={username}
											onChange={(e) => setUsername(e.target.value)}
											className="w-full bg-foreground/4 border border-foreground/8 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-amber-400/50 focus:bg-foreground/6 transition-all placeholder:text-foreground/20"
											placeholder="Virat Kohli"
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


			{/* Image Crop Modal */}
			<AnimatePresence>
				{showCropModal && (
					<ImageCropModal 
						image={imageToCrop}
						onCropComplete={handleCropComplete}
						onCancel={() => setShowCropModal(false)}
					/>
				)}
			</AnimatePresence>
		</div>
	)
}