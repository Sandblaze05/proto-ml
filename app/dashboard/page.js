'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Share2, Trash2, Layout, Clock, User, ExternalLink, Edit2, Check, X, Copy, Search, Grid, List, SortAsc, SortDesc, Folder, FolderPlus, ChevronRight, ChevronDown, Star, StarOff, GripVertical } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUIStore } from '@/store/useUIStore'

const THUMBNAIL_COLOR_MAP = {
	'dataset.image': '#c084fc',
	'dataset.csv': '#34d399',
	'dataset.text': '#60a5fa',
	'dataset.json': '#fbbf24',
	'dataset.database': '#f87171',
	'dataset.api': '#a78bfa',
	'transform': '#38bdf8',
	'lifecycle': '#f59e0b',
	'process': '#10b981',
	'datasetNode': '#34d399',
	'transformNode': '#38bdf8',
	'lifecycleNode': '#f59e0b'
}

const TYPE_LABEL_MAP = {
	'datasetNode': 'DATASET NODE',
	'transformNode': 'TRANSFORM NODE',
	'lifecycleNode': 'LIFECYCLE NODE',
	'dataset.image': 'DATASET NODE',
	'dataset.csv': 'DATASET NODE',
	'dataset.text': 'DATASET NODE',
	'dataset.json': 'DATASET NODE',
	'dataset.database': 'DATASET NODE',
	'dataset.api': 'DATASET NODE',
}

const PipelineThumbnail = React.memo(({ nodes = [], edges = [] }) => {
	if (!nodes || nodes.length === 0) {
		return (
			<div className="w-full h-32 bg-foreground/[0.03] rounded-xl mb-4 relative overflow-hidden flex items-center justify-center group-hover:bg-foreground/[0.05] transition-colors">
				<div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
				<Layout size={24} className="text-foreground/10" />
			</div>
		)
	}

	const validNodes = nodes.filter(n =>
		n.type !== 'annotationNode' &&
		n.position &&
		typeof n.position.x === 'number'
	)

	if (validNodes.length === 0) return <div className="w-full h-32 bg-foreground/[0.03] rounded-xl mb-4" />

	const minX = Math.min(...validNodes.map(n => n.position.x))
	const minY = Math.min(...validNodes.map(n => n.position.y))
	const maxX = Math.max(...validNodes.map(n => n.position.x + 180))
	const maxY = Math.max(...validNodes.map(n => n.position.y + 80))

	const width = Math.max(maxX - minX, 1)
	const height = Math.max(maxY - minY, 1)
	const padding = 20

	const scale = Math.min((300 - padding * 2) / width, (128 - padding * 2) / height, 0.4)

	return (
		<div className="w-full h-32 bg-foreground/[0.03] rounded-xl mb-4 relative overflow-hidden group-hover:bg-foreground/[0.05] transition-colors border border-foreground/5">
			<div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '6px 6px' }} />

			<div className="relative w-full h-full flex items-center justify-center">
				<div
					className="relative"
					style={{
						width: width * scale,
						height: height * scale,
					}}
				>
					<svg
						className="absolute inset-0 overflow-visible pointer-events-none opacity-40"
						style={{ width: '100%', height: '100%' }}
					>
						{edges.map((edge, i) => {
							const source = validNodes.find(n => n.id === edge.source)
							const target = validNodes.find(n => n.id === edge.target)
							if (!source || !target) return null

							const sx = (source.position.x - minX + 180) * scale
							const sy = (source.position.y - minY + 40) * scale
							const tx = (target.position.x - minX) * scale
							const ty = (target.position.y - minY + 40) * scale

							return (
								<path
									key={i}
									d={`M ${sx} ${sy} C ${sx + 20 * scale} ${sy}, ${tx - 20 * scale} ${ty}, ${tx} ${ty}`}
									stroke="currentColor"
									strokeWidth={1}
									fill="none"
								/>
							)
						})}
					</svg>

					{validNodes.map((node, i) => {
						const model = node.data?.nodeModel || {}
						const type = model.type || node.type || ''
						const color = THUMBNAIL_COLOR_MAP[type] || THUMBNAIL_COLOR_MAP[node.type] || '#faebd7'
						const label = model.label || node.data?.label || 'Untitled'
						const typeLabel = TYPE_LABEL_MAP[node.type] || 'NODE'

						const left = (node.position.x - minX) * scale
						const top = (node.position.y - minY) * scale

						return (
							<div
								key={i}
								className="absolute rounded-md border-[0.5px] shadow-sm p-1.5 flex flex-col justify-center gap-0.5 overflow-hidden"
								style={{
									left,
									top,
									width: 180 * scale,
									height: 80 * scale,
									borderColor: `${color}40`,
									backgroundColor: `${color}20`,
									backdropFilter: 'blur(2px)'
								}}
							>
								<div className="flex items-center gap-1 min-w-0">
									<div
										className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
										style={{ backgroundColor: color }}
									/>
									<span className="text-[5px] font-bold text-foreground truncate uppercase tracking-tighter">
										{label}
									</span>
								</div>
								<div
									className="text-[3.5px] font-bold opacity-40 tracking-widest truncate pl-3.5"
									style={{ color }}
								>
									{typeLabel}
								</div>
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}, (prevProps, nextProps) => {
	return prevProps.nodes.length === nextProps.nodes.length &&
		prevProps.edges.length === nextProps.edges.length
})

const ACTIVE_PIPELINE_ID_KEY = 'protoMlActivePipelineId'
const DRAFT_PIPELINE_NAME_KEY = 'protoMlDraftPipelineName'
const STARRED_FOLDER_NAME = 'Starred'
const UNCATEGORIZED_FOLDER_NAME = 'Uncategorized'

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
	const [searchQuery, setSearchQuery] = useState('')
	const [viewMode, setViewMode] = useState('grid')
	const [sortBy, setSortBy] = useState('updated_at')
	const [sortOrder, setSortOrder] = useState('desc')
	const [expandedFolders, setExpandedFolders] = useState(['Uncategorized'])
	const [movingToFolder, setMovingToFolder] = useState(null)
	const [isAddingFolder, setIsAddingFolder] = useState(false)
	const [newFolderName, setNewFolderName] = useState('')
	const [customFolders, setCustomFolders] = useState([])
	const [renamingFolder, setRenamingFolder] = useState(null)
	const [renameFolderValue, setRenameFolderValue] = useState('')
	const [confirmDelete, setConfirmDelete] = useState({ type: null, id: null, name: null })
	const [movingPipelineId, setMovingPipelineId] = useState(null)
	const [draggedPipelineId, setDraggedPipelineId] = useState(null)
	const [dragOverFolder, setDragOverFolder] = useState(null)

	const { addToast, setNodes, setEdges, setDrawings } = useUIStore()
	const router = useRouter()
	const supabase = createClient()

	const folders = useMemo(() => {
		const f = new Set([UNCATEGORIZED_FOLDER_NAME, ...customFolders])
		myPipelines.forEach(p => {
			if (!p.is_starred && p.folder) f.add(p.folder)
		})
		return [STARRED_FOLDER_NAME, ...Array.from(f).sort().filter(folder => folder !== STARRED_FOLDER_NAME)]
	}, [myPipelines, customFolders])

	const filteredMyPipelines = useMemo(() => {
		return myPipelines
			.filter(p => (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
			.sort((a, b) => {
				if ((a.is_starred ? 1 : 0) !== (b.is_starred ? 1 : 0)) {
					return (a.is_starred ? -1 : 0) - (b.is_starred ? -1 : 0)
				}
				const valA = a[sortBy] || ''
				const valB = b[sortBy] || ''
				if (sortOrder === 'asc') return valA > valB ? 1 : -1
				return valA < valB ? 1 : -1
			})
	}, [myPipelines, searchQuery, sortBy, sortOrder])

	const groupedPipelines = useMemo(() => {
		const groups = {}
		folders.forEach(f => groups[f] = [])

		filteredMyPipelines.forEach(p => {
			const f = p.is_starred ? STARRED_FOLDER_NAME : (p.folder || UNCATEGORIZED_FOLDER_NAME)
			if (groups[f]) groups[f].push(p)
		})
		return groups
	}, [filteredMyPipelines, folders])

	const filteredSharedPipelines = useMemo(() => {
		return sharedPipelines
			.filter(p => (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
			.sort((a, b) => {
				const valA = a[sortBy] || ''
				const valB = b[sortBy] || ''
				if (sortOrder === 'asc') return valA > valB ? 1 : -1
				return valA < valB ? 1 : -1
			})
	}, [sharedPipelines, searchQuery, sortBy, sortOrder])

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
				else {
					setMyPipelines(mine)
					const foundFolders = new Set([UNCATEGORIZED_FOLDER_NAME])
					mine.forEach(p => {
						if (p.is_starred) foundFolders.add(STARRED_FOLDER_NAME)
						else if (p.folder) foundFolders.add(p.folder)
					})
					setExpandedFolders(prev => Array.from(new Set([...prev, ...foundFolders])))
				}

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

	const handleMoveToFolder = async (e, pipelineId, folderName) => {
		if (e) {
			e.preventDefault()
			e.stopPropagation()
		}

		const targetFolder = folderName === UNCATEGORIZED_FOLDER_NAME ? null : folderName

		try {
			const { error } = await supabase
				.from('pipelines')
				.update({ folder: targetFolder, original_folder: null })
				.eq('id', pipelineId)

			if (error) throw error

			setMyPipelines(prev => prev.map(p => p.id === pipelineId ? { ...p, folder: targetFolder, original_folder: null } : p))
			setMovingToFolder(null)
			addToast(`Pipeline moved to ${folderName}.`, 'success')
		} catch (err) {
			console.error('Move error:', err)
			addToast(err.message || 'Failed to move pipeline.', 'error')
		}
	}

	const handleStarPipeline = async (pipeline) => {
		try {
			const nextStarState = !pipeline.is_starred
			const restoreFolder = pipeline.original_folder ?? (pipeline.folder === STARRED_FOLDER_NAME ? null : pipeline.folder || null)
			const nextFolder = nextStarState ? STARRED_FOLDER_NAME : restoreFolder
			const { error } = await supabase
				.from('pipelines')
				.update({
					is_starred: nextStarState,
					folder: nextFolder,
					original_folder: nextStarState ? restoreFolder : null,
				})
				.eq('id', pipeline.id)
				.eq('user_id', user.id)

			if (error) throw error

			setMyPipelines(prev => prev.map(item => (
				item.id === pipeline.id
					? {
						...item,
						is_starred: nextStarState,
						folder: nextFolder,
						original_folder: nextStarState ? restoreFolder : null,
					}
					: item
			)))
			addToast(nextStarState ? 'Pipeline starred.' : 'Pipeline unstarred.', 'success')
		} catch (err) {
			console.error('Star error:', err)
			addToast('Failed to update star state.', 'error')
		}
	}

	const handlePipelineDragStart = (pipelineId) => (event) => {
		setDraggedPipelineId(pipelineId)
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move'
			event.dataTransfer.setData('text/plain', pipelineId)
		}
	}

	const handlePipelineDragEnd = () => {
		setDraggedPipelineId(null)
		setDragOverFolder(null)
	}

	const handleFolderDragOver = (folderName) => (event) => {
		event.preventDefault()
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
		setDragOverFolder(folderName)
	}

	const handleFolderDragLeave = () => {
		setDragOverFolder(null)
	}

	const handleFolderDrop = (folderName) => async (event) => {
		event.preventDefault()
		const pipelineId = event.dataTransfer?.getData('text/plain') || draggedPipelineId
		setDragOverFolder(null)
		setDraggedPipelineId(null)
		if (!pipelineId) return

		if (folderName === STARRED_FOLDER_NAME) {
			const pipeline = myPipelines.find(p => p.id === pipelineId)
			if (pipeline && !pipeline.is_starred) {
				await handleStarPipeline(pipeline)
			}
		} else {
			await handleMoveToFolder(event, pipelineId, folderName)
		}
	}

	const toggleFolder = (folderName) => {
		setExpandedFolders(prev =>
			prev.includes(folderName)
				? prev.filter(f => f !== folderName)
				: [...prev, folderName]
		)
	}

	const handleAddFolder = () => {
		const name = newFolderName.trim()
		if (!name) return
		if (folders.includes(name)) {
			addToast('Folder already exists.', 'error')
			return
		}
		setCustomFolders(prev => [...prev, name])
		setExpandedFolders(prev => [...prev, name])
		setIsAddingFolder(false)
		setNewFolderName('')
		addToast(`Folder "${name}" created.`, 'success')
	}

	const handleRenameFolder = async (oldName) => {
		const newName = renameFolderValue.trim()
		if (!newName || newName === oldName) {
			setRenamingFolder(null)
			return
		}

		try {
			const { error } = await supabase
				.from('pipelines')
				.update({ folder: newName })
				.eq('folder', oldName)

			if (error) throw error

			setMyPipelines(prev => prev.map(p => p.folder === oldName ? { ...p, folder: newName } : p))
			setCustomFolders(prev => prev.map(f => f === oldName ? newName : f))
			setRenamingFolder(null)
			addToast(`Folder renamed to ${newName}.`, 'success')
		} catch (err) {
			addToast('Failed to rename folder.', 'error')
		}
	}

	const handleDeleteFolder = async (folderName) => {
		try {
			const { error } = await supabase
				.from('pipelines')
				.delete()
				.eq('folder', folderName)

			if (error) throw error

			setMyPipelines(prev => prev.filter(p => p.folder !== folderName))
			setCustomFolders(prev => prev.filter(f => f !== folderName))
			setConfirmDelete({ type: null, id: null, name: null })
			addToast(`Folder "${folderName}" and its pipelines deleted.`, 'success')
		} catch (err) {
			addToast('Failed to delete folder.', 'error')
		}
	}

	const handleShareFolder = async (folderName) => {
		const items = groupedPipelines[folderName] || []
		if (items.length === 0) {
			addToast('Cannot share an empty folder.', 'error')
			return
		}
		setSelectedPipeline(items[0])
		setShareModalOpen(true)
	}

	const handleDelete = async (id) => {
		try {
			const { error } = await supabase
				.from('pipelines')
				.delete()
				.eq('id', id)

			if (error) throw error
			setMyPipelines(prev => prev.filter(p => p.id !== id))
			setConfirmDelete({ type: null, id: null, name: null })
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

	const handleDuplicate = async (pipeline) => {
		if (!user) return

		try {
			const { data, error } = await supabase
				.from('pipelines')
				.insert({
					user_id: user.id,
					name: `${pipeline.name || 'Untitled Pipeline'} (Copy)`,
					nodes: pipeline.nodes || [],
					edges: pipeline.edges || [],
				})
				.select('*')
				.single()

			if (error) throw error

			setMyPipelines((prev) => [data, ...prev])
			addToast('Pipeline duplicated.', 'success')
		} catch (err) {
			console.error('Duplicate error:', err)
			addToast('Failed to duplicate pipeline.', 'error')
		}
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

				<header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-foreground/10 pb-6 gap-4">
					<div>
						<h1 className="text-4xl font-bold tracking-tighter uppercase">My Pipelines</h1>
						<p className="text-foreground/50 text-sm mt-2">Manage your saved and shared ML workflows</p>
					</div>
					<button
						onClick={handleNewCanvas}
						className="px-6 py-2 bg-foreground text-background font-bold rounded-full hover:opacity-90 transition-all cursor-pointer w-full md:w-auto text-center"
					>
						New Canvas
					</button>
				</header>

				{/* Controls Section */}
				<div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-4 bg-foreground/5 p-4 rounded-2xl border border-foreground/10">
					<div className="relative w-full md:w-96">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" size={18} />
						<input
							type="text"
							placeholder="Search pipelines..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full bg-background border border-foreground/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:border-foreground/30 outline-none transition-all"
						/>
					</div>

					<div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
						<div className="flex items-center gap-2 bg-background border border-foreground/10 rounded-xl p-1">
							<button
								onClick={() => setViewMode('grid')}
								className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-foreground text-background' : 'text-foreground/40 hover:text-foreground'}`}
								title="Grid View"
							>
								<Grid size={18} />
							</button>
							<button
								onClick={() => setViewMode('list')}
								className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-foreground text-background' : 'text-foreground/40 hover:text-foreground'}`}
								title="List View"
							>
								<List size={18} />
							</button>
						</div>

						<div className="h-6 w-px bg-foreground/10 mx-1" />

						<div className="flex items-center gap-2">
							<select
								value={sortBy}
								onChange={(e) => setSortBy(e.target.value)}
								className="bg-background border border-foreground/10 rounded-xl py-2 px-3 text-xs font-bold uppercase tracking-wider outline-none focus:border-foreground/30 cursor-pointer"
							>
								<option value="updated_at">Last Updated</option>
								<option value="name">Name</option>
							</select>
							<button
								onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
								className="p-2 bg-background border border-foreground/10 rounded-xl text-foreground/60 hover:text-foreground transition-all"
								title={sortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
							>
								{sortOrder === 'asc' ? <SortAsc size={18} /> : <SortDesc size={18} />}
							</button>
						</div>
					</div>
				</div>

				<section className="mb-16">
					<div className="flex justify-between items-center mb-6">
						<h2 className="text-xl font-bold flex items-center gap-2">
							<Layout size={20} /> Personal Workspaces
							<span className="text-xs font-normal text-foreground/40 ml-2 bg-foreground/5 px-2 py-0.5 rounded-full">{filteredMyPipelines.length}</span>
						</h2>
						<div className="flex gap-2">
							{isAddingFolder ? (
								<div className="flex gap-2">
									<input
										value={newFolderName}
										onChange={(e) => setNewFolderName(e.target.value)}
										className="text-xs bg-background border border-foreground/20 rounded-lg px-3 py-1 outline-none"
										placeholder="Folder name..."
										autoFocus
										onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
									/>
									<button onClick={handleAddFolder} className="p-1 hover:text-emerald-400"><Check size={16} /></button>
									<button onClick={() => setIsAddingFolder(false)} className="p-1 hover:text-red-400"><X size={16} /></button>
								</div>
							) : (
								<button
									onClick={() => setIsAddingFolder(true)}
									className="text-xs font-bold uppercase tracking-widest text-foreground/40 hover:text-foreground flex items-center gap-2 bg-foreground/5 px-3 py-1 rounded-lg transition-all"
								>
									<FolderPlus size={14} /> New Folder
								</button>
							)}
						</div>
					</div>

					{filteredMyPipelines.length === 0 ? (
						<div className="border-2 border-dashed border-foreground/10 rounded-3xl p-16 text-center bg-foreground/[0.02] flex flex-col items-center gap-6">
							<div className="w-16 h-16 bg-foreground/5 rounded-2xl flex items-center justify-center text-foreground/20">
								<Layout size={32} />
							</div>
							<div className="max-w-sm">
								<p className="text-foreground font-bold text-lg mb-2">
									{searchQuery ? `No pipelines matching "${searchQuery}"` : 'Your workspace is empty'}
								</p>
								<p className="text-foreground/50 text-sm">
									{searchQuery
										? 'Try adjusting your search terms or filters to find what you are looking for.'
										: 'Start by creating your first ML pipeline. You can drag and drop nodes to build your workflow.'}
								</p>
							</div>
							{!searchQuery && (
								<button
									onClick={handleNewCanvas}
									className="px-8 py-3 bg-foreground text-background font-bold rounded-xl hover:opacity-90 transition-all cursor-pointer shadow-lg flex items-center gap-2"
								>
									Create New Pipeline <ExternalLink size={16} />
								</button>
							)}
							{searchQuery && (
								<button
									onClick={() => setSearchQuery('')}
									className="text-foreground/60 hover:text-foreground font-bold text-sm underline underline-offset-4"
								>
									Clear search query
								</button>
							)}
						</div>
					) : (
						<div className="space-y-6">
							{Object.entries(groupedPipelines).map(([folderName, items]) => {
								if (folderName === UNCATEGORIZED_FOLDER_NAME && items.length === 0) return null

								return (
									<div key={folderName} className="space-y-4">
										<div className="flex items-center gap-2 group w-full">
											<button
												onClick={() => toggleFolder(folderName)}
												onDragOver={handleFolderDragOver(folderName)}
												onDragLeave={handleFolderDragLeave}
												onDrop={handleFolderDrop(folderName)}
												className={`flex items-center gap-2 flex-1 rounded-xl px-2 py-1 transition-colors ${dragOverFolder === folderName ? 'bg-amber-400/10 border border-amber-400/30' : ''}`}
											>
												{expandedFolders.includes(folderName) ? <ChevronDown size={18} className="text-foreground/20" /> : <ChevronRight size={18} className="text-foreground/20" />}
												{folderName === STARRED_FOLDER_NAME ? <Star size={18} className="text-amber-400/80" /> : <Folder size={18} className={folderName === UNCATEGORIZED_FOLDER_NAME ? "text-foreground/20" : "text-amber-400/60"} />}
												{renamingFolder === folderName ? (
													<input
														value={renameFolderValue}
														onChange={(e) => setRenameFolderValue(e.target.value)}
														className="text-xs bg-transparent border-b border-foreground/20 outline-none font-bold uppercase tracking-widest"
														autoFocus
														onKeyDown={(e) => {
															if (e.key === 'Enter') handleRenameFolder(folderName)
															if (e.key === 'Escape') setRenamingFolder(null)
														}}
													/>
												) : (
													<span className="font-bold text-sm uppercase tracking-widest">{folderName}</span>
												)}
												<span className="text-[10px] text-foreground/20 bg-foreground/5 px-1.5 py-0.5 rounded-full">{items.length}</span>
											</button>

											{folderName !== UNCATEGORIZED_FOLDER_NAME && folderName !== STARRED_FOLDER_NAME && (
												<div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
													{renamingFolder === folderName ? (
														<button onClick={() => handleRenameFolder(folderName)} className="p-1 text-emerald-400"><Check size={14} /></button>
													) : (
														<button onClick={() => { setRenamingFolder(folderName); setRenameFolderValue(folderName) }} className="p-1 text-foreground/40 hover:text-foreground"><Edit2 size={14} /></button>
													)}
													<button onClick={() => handleShareFolder(folderName)} className="p-1 text-foreground/40 hover:text-blue-400" title="Share Folder"><Share2 size={14} /></button>
													<button onClick={() => setConfirmDelete({ type: 'folder', name: folderName })} className="p-1 text-foreground/40 hover:text-red-400" title="Delete Folder"><Trash2 size={14} /></button>
												</div>
											)}
											<div className={`flex-1 h-px transition-colors ${dragOverFolder === folderName ? 'bg-amber-400/40' : 'bg-foreground/5'}`} />
										</div>

										{expandedFolders.includes(folderName) && (
											<>
												{items.length === 0 ? (
													<div
														onDragOver={handleFolderDragOver(folderName)}
														onDragLeave={handleFolderDragLeave}
														onDrop={handleFolderDrop(folderName)}
														className={`border border-dashed rounded-2xl py-8 text-center text-xs font-bold uppercase tracking-widest transition-colors ${dragOverFolder === folderName ? 'border-amber-400/40 bg-amber-400/5 text-amber-400/60' : 'border-foreground/10 text-foreground/20'}`}
													>
														{folderName === STARRED_FOLDER_NAME ? 'Drop here to star' : 'Empty Folder — Move projects here'}
													</div>
												) : (
													<div
														onDragOver={handleFolderDragOver(folderName)}
														onDragLeave={handleFolderDragLeave}
														onDrop={handleFolderDrop(folderName)}
														className={`rounded-2xl transition-colors ${dragOverFolder === folderName ? 'ring-1 ring-amber-400/30 bg-amber-400/[0.02]' : ''} ${viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-3"}`}
													>
														{items.map(p => (
															<div
																key={p.id}
																draggable
																onDragStart={handlePipelineDragStart(p.id)}
																onDragEnd={handlePipelineDragEnd}
																className={`group bg-foreground/5 border border-foreground/10 rounded-2xl hover:border-foreground/30 transition-all shadow-sm cursor-grab active:cursor-grabbing ${draggedPipelineId === p.id ? 'opacity-60 scale-[0.99]' : ''} ${viewMode === 'list' ? 'flex items-center justify-between p-4' : 'p-6'}`}
															>
																<div className={viewMode === 'list' ? "flex items-center gap-6 flex-1 min-w-0" : ""}>
																	{viewMode === 'grid' && <PipelineThumbnail nodes={p.nodes} edges={p.edges} />}
																	<div className={`flex justify-between items-start ${viewMode === 'list' ? 'mb-0 flex-1' : 'mb-4'}`}>
																		{renamingId === p.id ? (
																			<div className="flex items-center gap-2 flex-1 mr-4">
																				<input
																					value={renameValue}
																					onChange={(e) => setRenameValue(e.target.value)}
																					className="text-lg font-bold bg-transparent border-b border-foreground/20 outline-none w-full"
																					autoFocus
																					onKeyDown={(e) => {
																						if (e.key === 'Enter') handleRename(p.id)
																						if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') }
																					}}
																				/>
																				<div className="flex gap-1">
																					<button onClick={() => handleRename(p.id)} className="p-2 text-foreground/40 hover:text-emerald-400 transition-colors" title="Save name"><Check size={16} /></button>
																					<button onClick={() => { setRenamingId(null); setRenameValue('') }} className="p-2 text-foreground/40 hover:text-foreground transition-colors" title="Cancel rename"><X size={16} /></button>
																				</div>
																			</div>
																		) : (
																			<>
																				<div className="flex items-center gap-2 min-w-0 pr-4">
																					<h3 className={`text-lg font-bold truncate ${viewMode === 'list' ? 'max-w-[200px] md:max-w-md' : ''}`}>{p.name || 'Untitled Pipeline'}</h3>
																					{p.is_starred && <Star size={14} className="text-amber-400 shrink-0" title="Starred" />}
																				</div>
																				<div className="flex gap-1">
																					<button
																						onClick={(e) => { e.stopPropagation(); handleStarPipeline(p) }}
																						className={`p-2 transition-colors ${p.is_starred ? 'text-amber-400 hover:text-amber-300' : 'text-foreground/40 hover:text-amber-400'}`}
																						title={p.is_starred ? 'Unstar' : 'Star'}
																					>
																						{p.is_starred ? <StarOff size={16} /> : <Star size={16} />}
																					</button>

																					{!p.is_starred ? (
																						<div className="relative">
																							<button
																								onClick={(e) => {
																									e.stopPropagation()
																									setMovingPipelineId(movingPipelineId === p.id ? null : p.id)
																								}}
																								className={`p-2 transition-colors ${movingPipelineId === p.id ? 'text-amber-400' : 'text-foreground/40 hover:text-amber-400'}`}
																								title="Move to folder"
																							>
																								<Folder size={16} />
																							</button>
																							{movingPipelineId === p.id && (
																								<div className="absolute right-0 top-full mt-2 bg-background border border-foreground/10 rounded-2xl shadow-2xl py-3 z-[100] min-w-[180px] animate-in fade-in slide-in-from-top-2 duration-200">
																									<div className="px-4 pb-2 mb-2 border-b border-foreground/5 text-[8px] font-bold uppercase tracking-widest text-foreground/30">Select Folder</div>
																									<div className="max-h-[200px] overflow-y-auto px-2">
																										{folders.filter(f => f !== STARRED_FOLDER_NAME).map(f => (
																											<button
																												key={f}
																												type="button"
																												onClick={(e) => {
																													handleMoveToFolder(e, p.id, f)
																													setMovingPipelineId(null)
																												}}
																												className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-foreground/5 transition-colors flex items-center gap-2 ${p.folder === (f === UNCATEGORIZED_FOLDER_NAME ? null : f) ? 'text-amber-400 bg-amber-400/5' : 'text-foreground/60'}`}
																											>
																												<Folder size={12} className={f === UNCATEGORIZED_FOLDER_NAME ? 'opacity-20' : 'text-amber-400/40'} />
																												{f}
																											</button>
																										))}
																									</div>
																								</div>
																							)}
																						</div>
																					) : null}

																					<button onClick={() => handleStartRename(p)} className="p-2 text-foreground/40 hover:text-foreground transition-colors" title="Rename"><Edit2 size={16} /></button>
																					<button onClick={() => openShareModal(p)} className="p-2 text-foreground/40 hover:text-blue-400 transition-colors" title="Share"><Share2 size={16} /></button>
																					<button onClick={() => handleDuplicate(p)} className="p-2 text-foreground/40 hover:text-emerald-400 transition-colors" title="Duplicate"><Copy size={16} /></button>
																					<button onClick={() => setConfirmDelete({ type: 'pipeline', id: p.id, name: p.name })} className="p-2 text-foreground/40 hover:text-red-400 transition-colors" title="Delete"><Trash2 size={16} /></button>
																				</div>
																			</>
																		)}
																	</div>

																	<div className={`flex items-center gap-4 text-[10px] text-foreground/50 ${viewMode === 'list' ? 'mb-0' : 'mb-6'}`}>
																		<span className="flex items-center gap-1 whitespace-nowrap"><Clock size={12} /> {new Date(p.updated_at).toLocaleDateString()}</span>
																		<span className="flex items-center gap-1 whitespace-nowrap"><User size={12} /> Me</span>
																		<span className="flex items-center gap-1 whitespace-nowrap"><GripVertical size={12} /> Drag to folder</span>
																	</div>
																</div>

																<div className={viewMode === 'list' ? "flex items-center gap-4 ml-4" : ""}>
																	{viewMode === 'list' && (
																		<Link
																			href={`/canvas/${p.id}`}
																			className="flex items-center justify-center gap-2 bg-foreground text-background rounded-xl font-bold text-sm px-4 py-2 hover:opacity-90 transition-all"
																		>
																			Open <ExternalLink size={14} />
																		</Link>
																	)}
																	{viewMode === 'grid' && (
																		<Link
																			href={`/canvas/${p.id}`}
																			className="flex items-center justify-center gap-2 w-full py-3 bg-foreground/10 rounded-xl font-bold text-sm group-hover:bg-foreground group-hover:text-background transition-all"
																		>
																			Open Workspace <ExternalLink size={14} />
																		</Link>
																	)}
																</div>
															</div>
														))}
													</div>
												)}
											</>
										)}
									</div>
								)
							})}
						</div>
					)}
				</section>

				<section>
					<h2 className="text-xl font-bold mb-6 flex items-center gap-2">
						<Share2 size={20} /> Shared With Me
						<span className="text-xs font-normal text-foreground/40 ml-2 bg-foreground/5 px-2 py-0.5 rounded-full">{filteredSharedPipelines.length}</span>
					</h2>
					{filteredSharedPipelines.length === 0 ? (
						<div className="border border-foreground/10 rounded-3xl p-12 text-center bg-foreground/[0.01] flex flex-col items-center gap-4">
							<div className="w-12 h-12 bg-foreground/5 rounded-xl flex items-center justify-center text-foreground/20">
								<Share2 size={24} />
							</div>
							<div className="max-w-xs">
								<p className="text-foreground/60 font-bold text-sm">
									{searchQuery ? `No shared pipelines matching "${searchQuery}"` : 'No shared pipelines yet'}
								</p>
								{!searchQuery && (
									<p className="text-foreground/40 text-xs mt-1">
										When others share their pipelines with you, they will appear here.
									</p>
								)}
							</div>
							{searchQuery && (
								<button
									onClick={() => setSearchQuery('')}
									className="text-foreground/40 hover:text-foreground font-bold text-xs underline underline-offset-4"
								>
									Clear search
								</button>
							)}
						</div>
					) : (
						<div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-3"}>
							{filteredSharedPipelines.map(p => (
								<div key={p.id} className={`group bg-foreground/5 border border-foreground/10 rounded-2xl hover:border-foreground/30 transition-all shadow-sm ${viewMode === 'list' ? 'flex items-center justify-between p-4' : 'p-6'}`}>
									<div className={viewMode === 'list' ? "flex items-center gap-6 flex-1 min-w-0" : ""}>
										{viewMode === 'grid' && <PipelineThumbnail nodes={p.nodes} edges={p.edges} />}
										<div className={`flex justify-between items-start ${viewMode === 'list' ? 'mb-0 flex-1' : 'mb-4'}`}>
											<h3 className={`text-lg font-bold truncate pr-4 ${viewMode === 'list' ? 'max-w-[200px] md:max-w-md' : ''}`}>{p.name || 'Shared Pipeline'}</h3>
											<span className={`px-2 py-0.5 text-[8px] font-bold uppercase rounded border ${p.share_permission === 'edit' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
												{p.share_permission === 'edit' ? 'Can Edit' : 'Read Only'}
											</span>
										</div>
										<div className={`flex items-center gap-4 text-[10px] text-foreground/50 ${viewMode === 'list' ? 'mb-0' : 'mb-6'}`}>
											<span className="flex items-center gap-1 whitespace-nowrap"><Clock size={12} /> {new Date(p.updated_at).toLocaleDateString()}</span>
											<span className="flex items-center gap-1 whitespace-nowrap"><User size={12} /> {p.share_scope === 'public' ? 'Public link' : 'Direct share'}</span>
										</div>
									</div>

									<div className={viewMode === 'list' ? "flex items-center gap-2 ml-4" : "flex gap-2"}>
										<Link
											href={`/canvas/${p.id}?access=${p.share_permission === 'edit' ? 'edit' : 'view'}`}
											className={`flex items-center justify-center gap-2 bg-foreground/10 rounded-xl font-bold text-sm hover:bg-foreground hover:text-background transition-all ${viewMode === 'list' ? 'px-4 py-2' : 'w-full py-3'}`}
										>
											{viewMode === 'list' ? 'Open' : (p.share_permission === 'edit' ? 'Open Pipeline' : 'View Pipeline')} <ExternalLink size={14} />
										</Link>
										{p.share_permission !== 'edit' && (
											<button
												onClick={() => handleCreateCopy(p)}
												className={`bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-500/20 transition-colors flex items-center justify-center ${viewMode === 'list' ? 'w-10 h-10' : 'px-3 py-3'}`}
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

				{/* Confirmation Modal */}
				{confirmDelete.type && (
					<div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
						<div className="bg-background border border-foreground/20 rounded-3xl p-8 shadow-2xl max-w-sm w-full text-center">
							<div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
								<Trash2 size={32} />
							</div>
							<h3 className="text-xl font-bold mb-2">Delete {confirmDelete.type === 'folder' ? 'Folder' : 'Pipeline'}?</h3>
							<p className="text-foreground/50 text-sm mb-8">
								Are you sure you want to delete <span className="text-foreground font-bold">"{confirmDelete.name}"</span>?
								{confirmDelete.type === 'folder' ? " All pipelines inside will be gone forever." : " This action cannot be undone."}
							</p>
							<div className="flex gap-3">
								<button
									onClick={() => setConfirmDelete({ type: null, id: null, name: null })}
									className="flex-1 py-3 bg-foreground/5 hover:bg-foreground/10 text-foreground font-bold rounded-xl transition-colors"
								>
									Cancel
								</button>
								<button
									onClick={() => confirmDelete.type === 'folder' ? handleDeleteFolder(confirmDelete.name) : handleDelete(confirmDelete.id)}
									className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors"
								>
									Delete
								</button>
							</div>
						</div>
					</div>
				)}
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