'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Share2, Trash2, Layout, Clock, User, ExternalLink, Edit2, Check, X, Copy } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUIStore } from '@/store/useUIStore'

const ACTIVE_PIPELINE_ID_KEY = 'protoMlActivePipelineId'
const DRAFT_PIPELINE_NAME_KEY = 'protoMlDraftPipelineName'

const DashboardPage = () => {
	const [myPipelines, setMyPipelines] = useState([])
	const [sharedPipelines, setSharedPipelines] = useState([])
	const [loading, setLoading] = useState(true)
	const [user, setUser] = useState(null)
	const [renamingId, setRenamingId] = useState(null)
	const [renameValue, setRenameValue] = useState('')
	const [shareModalOpen, setShareModalOpen] = useState(false)
	const [selectedPipeline, setSelectedPipeline] = useState(null)
	const [recipientEmail, setRecipientEmail] = useState('')
	const [shareMode, setShareMode] = useState('email')
	const [sharePermission, setSharePermission] = useState('view')
	const [shareLink, setShareLink] = useState('')
	const [shareGenerated, setShareGenerated] = useState(false)
	const [isSharing, setIsSharing] = useState(false)
	const [copied, setCopied] = useState(false)
	const { addToast, setNodes, setEdges, setDrawings } = useUIStore()
	const router = useRouter()
	const supabase = createClient()

	const handleNewCanvas = () => {
		setNodes([])
		setEdges([])
		setDrawings([])
		useUIStore.setState({ history: [], future: [] })

		if (typeof window !== 'undefined') {
			localStorage.removeItem(ACTIVE_PIPELINE_ID_KEY)
			localStorage.removeItem(DRAFT_PIPELINE_NAME_KEY)
		}

		router.push('/canvas')
	}

	useEffect(() => {
		const fetchData = async () => {
			const { data: { user } } = await supabase.auth.getUser()
			setUser(user)

			if (user) {
				const { data: mine, error: errorMine } = await supabase
					.from('pipelines')
					.select('*')
					.eq('user_id', user.id)
					.order('updated_at', { ascending: false })

				if (errorMine) console.error('Error fetching mine:', errorMine)
				else setMyPipelines(mine)

				const { data: others, error: errorOthers } = await supabase
					.from('pipeline_shares')
					.select('permission, share_scope, pipeline:pipelines(*)')
					.eq('share_scope', 'email')
					.eq('shared_with_email', user.email.toLowerCase())
					.order('created_at', { ascending: false })

				if (errorOthers) console.error('Error fetching others:', errorOthers)
				else {
					const shared = (others || [])
						.filter((row) => row.pipeline)
						.map((row) => ({
							...row.pipeline,
							share_permission: row.permission,
							share_scope: row.share_scope || 'email',
						}))
					setSharedPipelines(shared)
				}
			}
			setLoading(false)
		}
		fetchData()
	}, [supabase])

	const handleDelete = async (id) => {
		if (!confirm('Are you sure you want to delete this pipeline?')) return

		try {
			const { error } = await supabase
				.from('pipelines')
				.delete()
				.eq('id', id)

			if (error) throw error
			setMyPipelines(prev => prev.filter(p => p.id !== id))
			addToast('Pipeline deleted.', 'success')
		} catch (err) {
			addToast('Failed to delete pipeline.', 'error')
		}
	}

	const handleStartRename = (pipeline) => {
		setRenamingId(pipeline.id)
		setRenameValue(pipeline.name || '')
	}

	const handleRename = async (id) => {
		const nextName = renameValue.trim()
		if (!nextName) {
			addToast('Pipeline name cannot be empty.', 'error')
			return
		}

		try {
			const { error } = await supabase
				.from('pipelines')
				.update({ name: nextName })
				.eq('id', id)
				.eq('user_id', user.id)

			if (error) throw error

			setMyPipelines((prev) => prev.map((p) => (p.id === id ? { ...p, name: nextName } : p)))
			setRenamingId(null)
			setRenameValue('')
			addToast('Pipeline renamed.', 'success')
		} catch (err) {
			console.error('Rename error:', err)
			addToast('Failed to rename pipeline.', 'error')
		}
	}

	const openShareModal = (pipeline) => {
		setSelectedPipeline(pipeline)
		setRecipientEmail('')
		setShareMode('email')
		setSharePermission('view')
		setShareGenerated(false)
		setShareLink('')
		setCopied(false)
		setShareModalOpen(true)
	}

	const handleShare = async () => {
		if (!selectedPipeline) return

		const normalizedEmail = recipientEmail.trim().toLowerCase()
		if (shareMode === 'email') {
			const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
			if (!isValidEmail) {
				addToast('Enter a valid recipient email.', 'error')
				return
			}
		}

		setIsSharing(true)
		try {
			let error = null
			if (shareMode === 'email') {
				const response = await supabase
					.from('pipeline_shares')
					.upsert(
						{
							pipeline_id: selectedPipeline.id,
							owner_id: user.id,
							share_scope: 'email',
							shared_with_email: normalizedEmail,
							permission: sharePermission,
						},
						{ onConflict: 'pipeline_id,shared_with_email' }
					)
				error = response.error
			} else {
				const deleteResponse = await supabase
					.from('pipeline_shares')
					.delete()
					.eq('pipeline_id', selectedPipeline.id)
					.eq('share_scope', 'public')

				if (deleteResponse.error) {
					error = deleteResponse.error
				} else {
					const insertResponse = await supabase
						.from('pipeline_shares')
						.insert({
							pipeline_id: selectedPipeline.id,
							owner_id: user.id,
							share_scope: 'public',
							shared_with_email: null,
							permission: sharePermission,
						})
					error = insertResponse.error
				}
			}

			if (error) throw error

			const link = `${window.location.origin}/canvas/${selectedPipeline.id}?access=${sharePermission}`
			setShareLink(link)
			setShareGenerated(true)
			addToast(shareMode === 'public' ? 'Public share link generated.' : 'Share link generated.', 'success')
		} catch (err) {
			console.error('Share error:', err)
			addToast('Failed to generate share link.', 'error')
		} finally {
			setIsSharing(false)
		}
	}

	const handleCopyShareLink = () => {
		navigator.clipboard.writeText(shareLink)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	const handleCreateCopy = async (pipeline) => {
		if (!user) return

		try {
			const { data, error } = await supabase
				.from('pipelines')
				.insert({
					user_id: user.id,
					name: `${pipeline.name || 'Shared Pipeline'} (Copy)`,
					nodes: pipeline.nodes || [],
					edges: pipeline.edges || [],
				})
				.select('*')
				.single()

			if (error) throw error

			setMyPipelines((prev) => [data, ...prev])
			addToast('Editable copy created in Personal Workspaces.', 'success')
		} catch (err) {
			console.error('Copy error:', err)
			addToast('Failed to create copy.', 'error')
		}
	}

	if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-foreground font-mono">Loading Projects...</div>

	return (
		<div className="min-h-screen bg-background text-foreground font-mono p-8">
			<div className="max-w-6xl mx-auto">
				<header className="flex justify-between items-center mb-12 border-b border-foreground/10 pb-6">
					<div>
						<h1 className="text-4xl font-bold tracking-tighter uppercase">My Pipelines</h1>
						<p className="text-foreground/50 text-sm mt-2">Manage your saved and shared ML workflows</p>
					</div>
					<button
						onClick={handleNewCanvas}
						className="px-6 py-2 bg-foreground text-background font-bold rounded-full hover:opacity-90 transition-all cursor-pointer"
					>
						New Canvas
					</button>
				</header>

				<section className="mb-16">
					<h2 className="text-xl font-bold mb-6 flex items-center gap-2">
						<Layout size={20} /> Personal Workspaces
					</h2>
					{myPipelines.length === 0 ? (
						<div className="border border-dashed border-foreground/20 rounded-2xl p-12 text-center text-foreground/40">
							No pipelines saved yet. Start building in the dashboard!
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{myPipelines.map(p => (
								<div key={p.id} className="group bg-foreground/5 border border-foreground/10 rounded-2xl p-6 hover:border-foreground/30 transition-all shadow-sm">
									<div className="flex justify-between items-start mb-4">
										{renamingId === p.id ? (
											<input
												value={renameValue}
												onChange={(e) => setRenameValue(e.target.value)}
												className="text-lg font-bold bg-transparent border border-foreground/20 rounded px-2 py-1 w-full mr-3"
												autoFocus
											/>
										) : (
											<h3 className="text-lg font-bold truncate pr-4">{p.name || 'Untitled Pipeline'}</h3>
										)}
										<div className="flex gap-2">
											{renamingId === p.id ? (
												<>
													<button
														onClick={() => handleRename(p.id)}
														className="p-2 text-foreground/40 hover:text-emerald-400 transition-colors"
														title="Save name"
													>
														<Check size={16} />
													</button>
													<button
														onClick={() => {
															setRenamingId(null)
															setRenameValue('')
														}}
														className="p-2 text-foreground/40 hover:text-foreground transition-colors"
														title="Cancel rename"
													>
														<X size={16} />
													</button>
												</>
											) : (
												<button
													onClick={() => handleStartRename(p)}
													className="p-2 text-foreground/40 hover:text-foreground transition-colors"
													title="Rename"
												>
													<Edit2 size={16} />
												</button>
											)}
											<button
												onClick={() => openShareModal(p)}
												className="p-2 text-foreground/40 hover:text-blue-400 transition-colors"
												title="Share"
											>
												<Share2 size={16} />
											</button>
											<button
												onClick={() => handleDelete(p.id)}
												className="p-2 text-foreground/40 hover:text-red-400 transition-colors"
												title="Delete"
											>
												<Trash2 size={16} />
											</button>
										</div>
									</div>
									<div className="flex items-center gap-4 text-[10px] text-foreground/50 mb-6">
										<span className="flex items-center gap-1"><Clock size={12} /> {new Date(p.updated_at).toLocaleDateString()}</span>
										<span className="flex items-center gap-1"><User size={12} /> Me</span>
									</div>
									<Link
										href={`/canvas/${p.id}`}
										className="flex items-center justify-center gap-2 w-full py-3 bg-foreground/10 rounded-xl font-bold text-sm group-hover:bg-foreground group-hover:text-background transition-all"
									>
										Open Workspace <ExternalLink size={14} />
									</Link>
								</div>
							))}
						</div>
					)}
				</section>

				<section>
					<h2 className="text-xl font-bold mb-6 flex items-center gap-2">
						<Share2 size={20} /> Shared With Me
					</h2>
					{sharedPipelines.length === 0 ? (
						<div className="border border-dashed border-foreground/20 rounded-2xl p-12 text-center text-foreground/40">
							No shared pipelines found.
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{sharedPipelines.map(p => (
								<div key={p.id} className="bg-foreground/5 border border-foreground/10 rounded-2xl p-6 hover:border-foreground/30 transition-all">
									<div className="flex justify-between items-start mb-4">
										<h3 className="text-lg font-bold truncate pr-4">{p.name || 'Shared Pipeline'}</h3>
										<span className={`px-2 py-0.5 text-[8px] font-bold uppercase rounded border ${p.share_permission === 'edit' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
											{p.share_permission === 'edit' ? 'Can Edit' : 'Read Only'}
										</span>
									</div>
									<div className="flex items-center gap-4 text-[10px] text-foreground/50 mb-6">
										<span className="flex items-center gap-1"><Clock size={12} /> {new Date(p.updated_at).toLocaleDateString()}</span>
										<span className="flex items-center gap-1"><User size={12} /> {p.share_scope === 'public' ? 'Public link' : 'Direct share'}</span>
									</div>
									<div className="flex gap-2">
										<Link
											href={`/canvas/${p.id}?access=${p.share_permission === 'edit' ? 'edit' : 'view'}`}
											className="flex items-center justify-center gap-2 w-full py-3 bg-foreground/10 rounded-xl font-bold text-sm hover:bg-foreground hover:text-background transition-all"
										>
											{p.share_permission === 'edit' ? 'Open Pipeline' : 'View Pipeline'} <ExternalLink size={14} />
										</Link>
										{p.share_permission !== 'edit' && (
											<button
												onClick={() => handleCreateCopy(p)}
												className="px-3 py-3 bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-500/20 transition-colors"
												title="Create editable copy"
											>
												<Copy size={14} />
											</button>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</section>
			</div>

			{shareModalOpen && (
				<div className="fixed inset-0 z-1000 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
					<div className="bg-background border border-foreground/20 rounded-2xl p-6 shadow-2xl max-w-md w-full">
						<h2 className="text-2xl font-bold font-mono text-foreground mb-2">Share Pipeline</h2>
						<p className="text-foreground/60 text-sm mb-4">{selectedPipeline?.name || 'Untitled Pipeline'}</p>

						<div className="space-y-3">
							<div>
								<label className="block text-xs font-bold uppercase tracking-wider text-foreground/60 mb-1">Share Mode</label>
								<div className="grid grid-cols-2 gap-2">
									<button
										onClick={() => {
											setShareMode('email')
											setShareGenerated(false)
											setShareLink('')
										}}
										className={`py-2 rounded-lg border text-xs font-bold uppercase tracking-wide transition-colors ${shareMode === 'email' ? 'bg-foreground text-background border-foreground' : 'border-foreground/20 text-foreground hover:bg-foreground/5'}`}
									>
										Specific Email
									</button>
									<button
										onClick={() => {
											setShareMode('public')
											setRecipientEmail('')
											setShareGenerated(false)
											setShareLink('')
										}}
										className={`py-2 rounded-lg border text-xs font-bold uppercase tracking-wide transition-colors ${shareMode === 'public' ? 'bg-foreground text-background border-foreground' : 'border-foreground/20 text-foreground hover:bg-foreground/5'}`}
									>
										Public Link
									</button>
								</div>
							</div>

							<div>
								{shareMode === 'email' ? (
									<>
										<label className="block text-xs font-bold uppercase tracking-wider text-foreground/60 mb-1">Recipient Email</label>
										<input
											type="email"
											value={recipientEmail}
											onChange={(e) => setRecipientEmail(e.target.value)}
											placeholder="name@example.com"
											className="w-full bg-foreground/5 border border-foreground/20 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/50"
										/>
									</>
								) : (
									<p className="text-[11px] text-foreground/50">Anyone with this link and a Proto-ML account can access.</p>
								)}
							</div>

							<div>
								<label className="block text-xs font-bold uppercase tracking-wider text-foreground/60 mb-1">Permission</label>
								<select
									value={sharePermission}
									onChange={(e) => setSharePermission(e.target.value)}
									className="w-full bg-foreground/5 border border-foreground/20 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/50"
								>
									<option value="view">View Only</option>
									<option value="edit">Can Edit</option>
								</select>
							</div>

							<button
								onClick={handleShare}
								disabled={isSharing}
								className="w-full py-2 bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity font-bold disabled:opacity-40"
							>
								{isSharing ? 'Generating Link...' : 'Generate Share Link'}
							</button>
						</div>

						{shareGenerated && (
							<div className="flex items-center gap-2 bg-foreground/5 p-2 rounded-lg border border-foreground/10 mt-4">
								<input
									type="text"
									readOnly
									value={shareLink}
									className="flex-1 bg-transparent border-none outline-none text-foreground text-sm font-mono px-2"
								/>
								<button
									onClick={handleCopyShareLink}
									className="p-2 bg-foreground text-background rounded-md hover:opacity-90 transition-opacity flex items-center gap-2"
								>
									{copied ? <Check size={16} /> : <Copy size={16} />}
									<span className="text-sm font-bold">{copied ? 'Copied!' : 'Copy'}</span>
								</button>
							</div>
						)}

						<button
							onClick={() => {
								setShareModalOpen(false)
								setShareMode('email')
								setRecipientEmail('')
								setShareGenerated(false)
								setShareLink('')
								setCopied(false)
							}}
							className="mt-6 w-full py-2 border border-foreground/20 text-foreground rounded-lg hover:bg-foreground/5 transition-colors font-bold"
						>
							Close
						</button>
					</div>
				</div>
			)}
		</div>
	)
}

export default DashboardPage