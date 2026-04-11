'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import DashboardSidebar from '@/components/dashboard/DashboardSidebar'
import DashboardTopBar from '@/components/dashboard/DashboardTopBar'
import PipelineThumbnail from '@/components/PipelineThumbnail'
import { Share2, Trash2, Layout, Clock, User, ExternalLink, Edit2, Check, X, Copy, Search, Grid, List, SortAsc, SortDesc, Folder, FolderPlus, ChevronRight, ChevronDown, Star, StarOff, GripVertical, Users, Eye, MoreVertical, Globe, Zap, Workflow, Cpu, Bot, Activity } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUIStore } from '@/store/useUIStore'
import { publishToCommunity } from '@/lib/community'
import DashboardSkeleton, { DashboardMainSkeleton } from '@/components/dashboard/DashboardSkeleton'
import CustomDropdown from '@/components/ui/CustomDropdown'

const ACTIVE_PIPELINE_ID_KEY = 'protoMlActivePipelineId'
const DRAFT_PIPELINE_NAME_KEY = 'protoMlDraftPipelineName'
const STARRED_FOLDER_NAME = 'Starred'
const UNCATEGORIZED_FOLDER_NAME = 'Uncategorized'

const DashboardPage = () => {
	const [myPipelines, setMyPipelines] = useState([])
	const [sharedPipelines, setSharedPipelines] = useState([])
	const [communityPipelines, setCommunityPipelines] = useState([])
	const [loading, setLoading] = useState(true)
	const [user, setUser] = useState(null)
	const [profile, setProfile] = useState(null)
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
	const [contextMenu, setContextMenu] = useState(null)
	const [publishModal, setPublishModal] = useState(null)
	const [publishDesc, setPublishDesc] = useState('')
	const [publishTags, setPublishTags] = useState('')
	const [isSidebarOpen, setIsSidebarOpen] = useState(false)

	const { addToast, setNodes, setEdges, setDrawings } = useUIStore()
	const router = useRouter()
	const searchParams = useSearchParams()
	const supabase = createClient()

	const [activeTab, setActiveTab] = useState('Home')

	const permissionOptions = [
		{ value: 'view', label: 'View Only', icon: Eye },
		{ value: 'edit', label: 'Can Edit', icon: Edit2 },
	]

	// Sync activeTab with URL
	useEffect(() => {
		const tab = searchParams.get('tab')
		if (tab) {
			const validTabs = ['Home', 'My Drive', 'Shared with me', 'Recent', 'Starred']
			if (validTabs.includes(tab)) {
				setActiveTab(tab)
			}
		}
	}, [searchParams])

	const handleTabChange = (tab) => {
		setActiveTab(tab)
		const params = new URLSearchParams(searchParams)
		params.set('tab', tab)
		router.push(`/dashboard?${params.toString()}`, { scroll: false })
	}

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

	const recentlyEdited = useMemo(() => {
		return [...myPipelines]
			.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
			.slice(0, 5)
	}, [myPipelines])

	useEffect(() => {
		const handleClickOutside = () => {
			if (contextMenu) setContextMenu(null)
		}
		document.addEventListener('click', handleClickOutside)
		return () => document.removeEventListener('click', handleClickOutside)
	}, [contextMenu])

	const handleContextMenu = (e, pipeline, type) => {
		e.preventDefault()
		e.stopPropagation()
		
		let x = e.clientX
		let y = e.clientY
		
		if (typeof window !== 'undefined') {
			if (x + 220 > window.innerWidth) x = window.innerWidth - 220
			if (y + 300 > window.innerHeight) y = window.innerHeight - 300
		}
		
		setContextMenu({
			x,
			y,
			pipelineId: pipeline.id,
			pipeline,
			type,
		})
	}

	const handleNewCanvas = async () => {
		setNodes([])
		setEdges([])
		setDrawings([])
		useUIStore.setState({ history: [], future: [] })

		if (typeof window !== 'undefined') {
			localStorage.removeItem(ACTIVE_PIPELINE_ID_KEY)
			localStorage.removeItem(DRAFT_PIPELINE_NAME_KEY)
		}

		if (user) {
			try {
				const { data, error } = await supabase
					.from('pipelines')
					.insert({
						user_id: user.id,
						name: '',
						nodes: [],
						edges: [],
					})
					.select('id')
					.single();
					
				if (!error && data) {
					router.push(`/canvas/${data.id}`);
					return;
				}
			} catch (e) {
				console.error('Failed to pre-create pipeline', e);
			}
		}

		router.push('/canvas')
	}

	useEffect(() => {
		const fetchData = async () => {
			const { data: { user } } = await supabase.auth.getUser()
			setUser(user)

			if (user) {
				// Fetch profile
				const { data: profileData } = await supabase
					.from('profiles')
					.select('*')
					.eq('id', user.id)
					.single()
				
				setProfile(profileData)

				const { data: mine, error: errorMine } = await supabase
					.from('pipelines')
					.select('*')
					.eq('user_id', user.id)
					.eq('is_snapshot', false)
					.order('updated_at', { ascending: false })

				if (errorMine) console.error('Error fetching mine:', errorMine)
				else {
					// 1. Fetch all shares for user's pipelines to determine is_shared flag
					const pipelineIds = mine.map(p => p.id)
					const { data: allSharedItems } = await supabase
						.from('pipeline_shares')
						.select('pipeline_id')
						.in('pipeline_id', pipelineIds)
					
					const sharedSet = new Set(allSharedItems?.map(s => s.pipeline_id) || [])
					
					// 2. Fetch all public snapshots to determine is_public (published) flag
					const { data: allSnapshots } = await supabase
						.from('pipelines')
						.select('parent_id')
						.in('parent_id', pipelineIds)
						.eq('is_snapshot', true)
						.eq('is_public', true)

					const publishedSet = new Set(allSnapshots?.map(s => s.parent_id) || [])

					const enhancedMine = mine.map(p => ({
						...p,
						is_shared: sharedSet.has(p.id),
						is_public: publishedSet.has(p.id)
					}))

					setMyPipelines(enhancedMine)
					const foundFolders = new Set([UNCATEGORIZED_FOLDER_NAME])
					enhancedMine.forEach(p => {
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
							is_shared: true,
							share_permission: row.permission,
							share_scope: row.share_scope || 'email',
						}))
					setSharedPipelines(shared)
				}

				// Fetch folders from DB
				const { data: dbFolders, error: folderError } = await supabase
					.from('folders')
					.select('name')
					.eq('user_id', user.id)
					.order('name', { ascending: true })
				
				if (!folderError && dbFolders) {
					const folderNames = dbFolders.map(f => f.name)
					setCustomFolders(folderNames)
				}
			}

			// Fetch community pipelines
			const { data: community, error: errorCommunity } = await supabase
				.from('pipelines')
				.select('*, profiles(username, avatar_url)')
				.eq('is_public', true)
				.eq('is_snapshot', true)
				.order('updated_at', { ascending: false })
				.limit(6)
			
			if (errorCommunity) console.error('Error fetching community:', errorCommunity)
			else setCommunityPipelines(community || [])

			setLoading(false)
		}
		fetchData()
	}, [supabase])

	const openPublishModal = (pipeline) => {
		setPublishModal(pipeline)
		setPublishDesc(pipeline.description || '')
		setPublishTags((pipeline.tags || []).join(', '))
	}

	const submitPublishToCommunity = async () => {
		try {
			const { data: { user } } = await supabase.auth.getUser()
			if (!user) throw new Error('User not found')

			await publishToCommunity(supabase, publishModal, {
				description: publishDesc,
				tags: publishTags
			})
			
			// No need to update local myPipelines because we published a separate snapshot
			// The original pipeline remains unchanged in the author's dashboard.
			
			addToast('Pipeline published! View in Community.', 'success')
			setPublishModal(null)
		} catch (err) {
			console.error('Publish error:', err)
			addToast('Failed to publish pipeline.', 'error')
		}
	}

	const handleMoveToFolder = async (e, pipelineId, folderName) => {
		if (e) {
			e.preventDefault()
			e.stopPropagation()
		}

		const targetFolder = folderName === UNCATEGORIZED_FOLDER_NAME ? null : folderName
		const pipeline = myPipelines.find(p => p.id === pipelineId)
		const currentFolder = pipeline?.folder || null

		// No-op move: avoid unnecessary writes and notifications.
		if (currentFolder === targetFolder) {
			setMovingToFolder(null)
			return
		}

		try {
			const { data, error } = await supabase
				.from('pipelines')
				.update({ folder: targetFolder, original_folder: null })
				.eq('id', pipelineId)
				.eq('user_id', user.id)
				.select('id, folder, original_folder')
				.maybeSingle()

			if (error) throw error
			if (!data) {
				setMovingToFolder(null)
				return
			}

			const didMove = (data.folder || null) === targetFolder
			if (!didMove) {
				setMovingToFolder(null)
				return
			}

			setMyPipelines(prev => prev.map(p => p.id === pipelineId ? { ...p, folder: data.folder, original_folder: data.original_folder } : p))
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

	const handleAddFolder = async () => {
		const name = newFolderName.trim()
		if (!name) return
		if (folders.includes(name)) {
			addToast('Folder already exists.', 'error')
			return
		}

		try {
			const { data, error } = await supabase
				.from('folders')
				.insert({ user_id: user.id, name })
				.select()
				.single()

			if (error) throw error

			setCustomFolders(prev => [...prev, name].sort())
			setExpandedFolders(prev => [...prev, name])
			setIsAddingFolder(false)
			setNewFolderName('')
			addToast(`Folder "${name}" created.`, 'success')
		} catch (err) {
			console.error('Add folder error:', err)
			addToast('Failed to create folder in database.', 'error')
		}
	}

	const handleRenameFolder = async (oldName) => {
		const newName = renameFolderValue.trim()
		if (!newName || newName === oldName) {
			setRenamingFolder(null)
			return
		}

		try {
			// 1. Update the folder record itself
			const { error: folderError } = await supabase
				.from('folders')
				.update({ name: newName })
				.eq('user_id', user.id)
				.eq('name', oldName)

			if (folderError) throw folderError

			// 2. Update all pipelines that were in this folder
			const { error: pipelineError } = await supabase
				.from('pipelines')
				.update({ folder: newName })
				.eq('user_id', user.id)
				.eq('folder', oldName)

			if (pipelineError) throw pipelineError

			setMyPipelines(prev => prev.map(p => p.folder === oldName ? { ...p, folder: newName } : p))
			setCustomFolders(prev => prev.map(f => f === oldName ? newName : f).sort())
			setRenamingFolder(null)
			addToast(`Folder renamed to ${newName}.`, 'success')
		} catch (err) {
			console.error('Rename folder error:', err)
			addToast('Failed to rename folder in database.', 'error')
		}
	}

	const handleDeleteFolder = async (folderName) => {
		try {
			// 1. Delete the persistent folder record
			const { error: folderError } = await supabase
				.from('folders')
				.delete()
				.eq('user_id', user.id)
				.eq('name', folderName)
			
			if (folderError) throw folderError

			// 2. Decide whether to delete pipelines or just un-folder them
			// For the sake of data safety, we'll un-folder them (move to Uncategorized)
			const { error: pipelineError } = await supabase
				.from('pipelines')
				.update({ folder: null })
				.eq('user_id', user.id)
				.eq('folder', folderName)

			if (pipelineError) throw pipelineError

			setMyPipelines(prev => prev.map(p => p.folder === folderName ? { ...p, folder: null } : p))
			setCustomFolders(prev => prev.filter(f => f !== folderName))
			setConfirmDelete({ type: null, id: null, name: null })
			addToast(`Folder "${folderName}" removed. Pipelines moved to Uncategorized.`, 'success')
		} catch (err) {
			console.error('Delete folder error:', err)
			addToast('Failed to remove folder from database.', 'error')
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
	const handleSignOut = async () => {
		try {
			const { error } = await supabase.auth.signOut()
			if (error) throw error
			router.push('/login')
		} catch (err) {
			console.error('Sign out error:', err)
			addToast('Failed to sign out.', 'error')
		}
	}

	const renderFlatList = (pipelines, icon = 'layout') => {
		const LucideIcon = icon === 'star' ? Star : (icon === 'clock' ? Clock : Layout)
		const filtered = pipelines.filter(p => (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
		
		if (filtered.length === 0) return (
			<div className="border-2 border-dashed border-foreground/10 rounded-3xl p-16 text-center bg-foreground/2 flex flex-col items-center gap-6">
				<div className="w-16 h-16 bg-foreground/5 rounded-2xl flex items-center justify-center text-foreground/20">
					<LucideIcon size={32} />
				</div>
				<div className="max-w-sm">
					<p className="text-foreground font-bold text-lg mb-2">
						{searchQuery ? `No pipelines matching "${searchQuery}"` : `No ${activeTab.toLowerCase()} yet`}
					</p>
					<p className="text-foreground/50 text-sm">
						{searchQuery ? 'Try adjusting your search terms.' : `Items you ${activeTab.toLowerCase() === 'starred' ? 'star' : 'interact with'} will appear here.`}
					</p>
				</div>
			</div>
		)

		return (
			<div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-3"}>
				{filtered.map(p => (
					<div
						key={p.id}
						onContextMenu={(e) => handleContextMenu(e, p, 'my')}
						className={`group bg-foreground/5 border border-foreground/10 rounded-2xl hover:border-foreground/30 transition-all shadow-sm cursor-pointer ${viewMode === 'list' ? 'flex flex-row items-center justify-between p-3' : 'p-6'} min-w-0 gap-2`}
					>
						<div className={viewMode === 'list' ? "flex items-center gap-3 sm:gap-6 flex-1 min-w-0" : "flex flex-col"}>
							{viewMode === 'list' ? (
								<div className="w-14 h-14 rounded-2xl bg-foreground/10 flex items-center justify-center shrink-0 border border-foreground/10 group-hover:border-foreground/20 transition-all pointer-events-none relative overflow-hidden">
									<div className="absolute inset-0 bg-[#FAEBD7]/5 animate-pulse" />
									<Workflow size={28} className="text-[#FAEBD7] relative z-10 opacity-80" />
								</div>
							) : (
								<PipelineThumbnail nodes={p.nodes} edges={p.edges} />
							)}
							
							<div className={`flex flex-col flex-1 min-w-0 ${viewMode === 'list' ? '' : 'mt-4 mb-4'}`}>
								<div className="flex justify-between items-start">
									<div className="flex items-center gap-2 min-w-0 pr-4 relative text-foreground flex-wrap">
										<h3 
											className={`font-bold truncate hover:text-[#FAEBD7] transition-colors cursor-pointer ${viewMode === 'list' ? 'text-base' : 'text-lg'}`}
											onClick={(e) => { e.stopPropagation(); router.push(`/canvas/${p.id}`) }}
										>
											{p.name || 'Untitled Pipeline'}
										</h3>
										<div className="flex items-center gap-1.5 shrink-0">
											{p.is_starred && <Star size={14} className="text-[#FAEBD7] fill-[#FAEBD7]/20" />}
											{p.is_shared && <Users size={14} className="text-blue-400" title="Shared with others" />}
											{p.is_public && <Globe size={14} className="text-emerald-400" title="Published to Community" />}
										</div>
									</div>
									{viewMode === 'grid' && (
										<button
											onClick={(e) => { e.stopPropagation(); handleContextMenu(e, p, 'my') }}
											className="p-1.5 hover:bg-foreground/10 rounded-lg text-foreground/40 hover:text-foreground transition-all"
										>
											<MoreVertical size={18} />
										</button>
									)}
								</div>
								<div className="flex items-center gap-4 text-[10px] text-foreground/50 mt-1">
									<span className="flex items-center gap-1"><Clock size={12} /> {new Date(p.updated_at).toLocaleDateString()}</span>
									{viewMode === 'list' && p.folder && (
										<span className="flex items-center gap-1 bg-foreground/5 px-2 py-0.5 rounded-full capitalize">
											<Folder size={10} /> {p.folder}
										</span>
									)}
								</div>
							</div>
						</div>

						<div className="flex items-center gap-2">
							{viewMode === 'list' && (
								<button
									onClick={(e) => { e.stopPropagation(); handleContextMenu(e, p, 'my') }}
									className="p-2.5 hover:bg-foreground/10 rounded-xl text-foreground/40 hover:text-foreground transition-all ml-1 sm:ml-4"
									title="More actions"
								>
									<MoreVertical size={20} />
								</button>
							)}
							{viewMode === 'grid' && (
								<Link 
									href={`/canvas/${p.id}`} 
									className="mt-6 block w-full py-3 bg-foreground/10 rounded-xl font-bold text-sm text-center group-hover:bg-foreground group-hover:text-background transition-all"
								>
									Open Workspace
								</Link>
							)}
						</div>
					</div>
				))}
			</div>
		)
	}

	const renderSharedTab = () => {
		if (filteredSharedPipelines.length === 0) return (
			<div className="border border-foreground/10 rounded-3xl p-12 text-center bg-foreground/5 flex flex-col items-center gap-4">
				<div className="w-12 h-12 bg-foreground/5 rounded-xl flex items-center justify-center text-foreground/20">
					<Share2 size={24} />
				</div>
				<p className="text-foreground/60 font-bold text-sm">No shared pipelines found</p>
			</div>
		)

		return (
			<div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-3"}>
				{filteredSharedPipelines.map(p => (
					<div 
						key={p.id} 
						onContextMenu={(e) => handleContextMenu(e, p, 'shared')}
						className={`group bg-foreground/5 border border-foreground/10 rounded-2xl hover:border-foreground/30 transition-all shadow-sm ${viewMode === 'list' ? 'flex flex-row items-center justify-between p-3 cursor-pointer' : 'p-6'} min-w-0 gap-2`}
						onClick={() => {
							if (viewMode === 'list') router.push(`/canvas/${p.id}?access=${p.share_permission === 'edit' ? 'edit' : 'view'}`)
						}}
					>
						<div className={viewMode === 'list' ? "flex items-center gap-3 sm:gap-6 flex-1 min-w-0" : "flex flex-col"}>
							{viewMode === 'list' ? (
								<div className="w-14 h-14 rounded-2xl bg-linear-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center shrink-0 border border-blue-500/20 group-hover:border-blue-500/40 transition-all pointer-events-none relative overflow-hidden">
									<div className="absolute inset-0 bg-blue-400/5 animate-pulse" />
									<Workflow size={28} className="text-blue-400 relative z-10" />
								</div>
							) : (
								<PipelineThumbnail nodes={p.nodes} edges={p.edges} />
							)}
							
							<div className={`flex flex-col flex-1 min-w-0 ${viewMode === 'list' ? '' : 'mt-4 mb-4'}`}>
								<div className="flex justify-between items-start">
									<div className="flex items-center gap-2 min-w-0 pr-4 relative text-foreground flex-wrap">
										<h3 
											className={`font-bold truncate group-hover:text-blue-400 transition-colors ${viewMode === 'list' ? 'text-base' : 'text-lg'}`}
										>
											{p.name || 'Shared Pipeline'}
										</h3>
										<div className="flex items-center gap-1.5 shrink-0">
											<span className="px-2 py-0.5 text-[8px] font-bold uppercase rounded border bg-blue-500/10 text-blue-400 border-blue-500/20">
												{p.share_permission === 'edit' ? 'Can Edit' : 'Read Only'}
											</span>
											{p.is_starred && <Star size={14} className="text-[#FAEBD7] fill-[#FAEBD7]/20" />}
											{p.is_shared && <Users size={14} className="text-blue-400" title="Shared with others" />}
											{p.is_public && <Globe size={14} className="text-emerald-400" title="Published" />}
										</div>
									</div>
									{viewMode === 'grid' && (
										<button
											onClick={(e) => { e.stopPropagation(); handleContextMenu(e, p, 'shared') }}
											className="p-1.5 hover:bg-foreground/10 rounded-lg text-foreground/40 hover:text-foreground transition-all"
										>
											<MoreVertical size={18} />
										</button>
									)}
								</div>
								<div className="flex items-center gap-4 text-[10px] text-foreground/50 mt-1">
									<span className="flex items-center gap-1"><Clock size={12} /> {new Date(p.updated_at).toLocaleDateString()}</span>
									<span className="flex items-center gap-1 ml-2"><User size={12} /> Shared with you</span>
								</div>
							</div>
						</div>

						<div className="flex items-center gap-2">
							{viewMode === 'list' && (
								<button
									onClick={(e) => { e.stopPropagation(); handleContextMenu(e, p, 'shared') }}
									className="p-2.5 hover:bg-foreground/10 rounded-xl text-foreground/40 hover:text-foreground transition-all ml-1 sm:ml-4"
									title="More actions"
								>
									<MoreVertical size={20} />
								</button>
							)}
							{viewMode === 'grid' && (
								<Link 
									href={`/canvas/${p.id}?access=${p.share_permission === 'edit' ? 'edit' : 'view'}`} 
									className="mt-6 block w-full py-3 bg-foreground/10 rounded-xl font-bold text-sm text-center group-hover:bg-foreground group-hover:text-background transition-all"
								>
									Open Shared Workspace
								</Link>
							)}
						</div>
					</div>
				))}
			</div>
		)
	}

	const renderHomeTab = () => (
		<section className="mb-16">
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
				<h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-foreground">
					<Layout size={20} /> Personal Workspaces
					<span className="text-xs font-normal text-foreground/40 ml-2 bg-foreground/5 px-2 py-0.5 rounded-full">{filteredMyPipelines.length}</span>
				</h2>
				<div className="flex gap-2 w-full sm:w-auto">
					{isAddingFolder ? (
						<div className="flex gap-2 w-full">
							<input
								value={newFolderName}
								onChange={(e) => setNewFolderName(e.target.value)}
								className="text-xs bg-background border border-foreground/20 rounded-lg px-3 py-1 outline-none text-foreground flex-1"
								placeholder="Folder name..."
								autoFocus
								onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
							/>
							<button onClick={handleAddFolder} className="p-1 hover:text-emerald-400 shrink-0"><Check size={16} /></button>
							<button onClick={() => setIsAddingFolder(false)} className="p-1 hover:text-red-400 shrink-0"><X size={16} /></button>
						</div>
					) : (
						<button
							onClick={() => setIsAddingFolder(true)}
							className="text-xs font-bold uppercase tracking-widest text-foreground/40 hover:text-foreground flex items-center justify-center gap-2 bg-foreground/5 px-3 py-2 sm:py-1 rounded-lg transition-all w-full sm:w-auto border border-foreground/5"
						>
							<FolderPlus size={14} /> New Folder
						</button>
					)}
				</div>
			</div>

			{filteredMyPipelines.length === 0 ? (
				<div className="border-2 border-dashed border-foreground/10 rounded-3xl p-16 text-center bg-foreground/5 flex flex-col items-center gap-6">
					<div className="w-16 h-16 bg-foreground/5 rounded-2xl flex items-center justify-center text-foreground">
						<Layout size={32} />
					</div>
					<div className="max-w-sm">
						<p className="text-foreground font-bold text-lg mb-2">Your workspace is empty</p>
						<button onClick={handleNewCanvas} className="px-8 py-3 bg-foreground text-background font-bold rounded-xl hover:opacity-90 shadow-lg flex items-center gap-2">
							Create New Pipeline <ExternalLink size={16} />
						</button>
					</div>
				</div>
			) : (
				<div className="space-y-6">
					{Object.entries(groupedPipelines).map(([folderName, items]) => {
						if (folderName === UNCATEGORIZED_FOLDER_NAME && items.length === 0) return null
						return (
							<div key={folderName} className="space-y-4">
								<div 
									className={`flex items-center gap-2 group w-full p-1 rounded-xl transition-colors ${dragOverFolder === folderName ? 'bg-amber-400/5 ring-1 ring-amber-400/20' : ''}`}
									onDragOver={handleFolderDragOver(folderName)}
									onDragLeave={handleFolderDragLeave}
									onDrop={handleFolderDrop(folderName)}
								>
									<button onClick={() => toggleFolder(folderName)} className="flex items-center gap-2 flex-1 text-foreground hover:text-amber-400 transition-colors">
										{expandedFolders.includes(folderName) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
										<Folder size={18} className={folderName === STARRED_FOLDER_NAME ? 'text-amber-400' : 'text-amber-400/60'} />
										<span className="font-bold text-sm uppercase tracking-widest">{folderName}</span>
										<span className="text-[10px] bg-foreground/5 px-1.5 py-0.5 rounded-full">{items.length}</span>
									</button>
								</div>
								{expandedFolders.includes(folderName) && (
									<div 
										className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-3"}
										onDragOver={handleFolderDragOver(folderName)}
										onDragLeave={handleFolderDragLeave}
										onDrop={handleFolderDrop(folderName)}
									>
										{items.length === 0 ? (
											<div className="col-span-full border border-dashed border-foreground/10 rounded-2xl py-8 text-center text-xs font-bold uppercase tracking-widest text-foreground/20 italic">
												Empty Folder — Drop projects here
											</div>
										) : items.map(p => (
											<div 
												key={p.id} 
												draggable
												onDragStart={handlePipelineDragStart(p.id)}
												onDragEnd={handlePipelineDragEnd}
												onContextMenu={(e) => handleContextMenu(e, p, 'my')}
												className={`group bg-foreground/5 border border-foreground/10 rounded-2xl hover:border-foreground/30 transition-all shadow-sm ${viewMode === 'list' ? 'flex flex-row items-center justify-between p-3 cursor-pointer' : 'p-6'} min-w-0 gap-2`}
												onClick={() => {
													if (viewMode === 'list') router.push(`/canvas/${p.id}`)
												}}
											>
												<div className={viewMode === 'list' ? "flex items-center gap-3 sm:gap-6 flex-1 min-w-0" : "flex flex-col"}>
													{viewMode === 'list' ? (
														<div className="w-14 h-14 rounded-2xl bg-foreground/10 flex items-center justify-center shrink-0 border border-foreground/10 group-hover:border-foreground/20 transition-all pointer-events-none relative overflow-hidden">
															<div className="absolute inset-0 bg-[#FAEBD7]/5 animate-pulse" />
															<Cpu size={28} className="text-[#FAEBD7] relative z-10 opacity-80" />
														</div>
													) : (
														<PipelineThumbnail nodes={p.nodes} edges={p.edges} />
													)}
													
													<div className={`flex flex-col flex-1 min-w-0 ${viewMode === 'list' ? '' : 'mt-4 mb-4'}`}>
														<div className="flex justify-between items-start">
															<div className="flex items-center gap-2 min-w-0 pr-4 relative text-foreground flex-wrap">
																<h3 className={`font-bold truncate group-hover:text-[#FAEBD7] transition-colors ${viewMode === 'list' ? 'text-base' : 'text-lg'}`}>
																	{p.name || 'Untitled Pipeline'}
																</h3>
																<div className="flex items-center gap-1.5 shrink-0">
																	{p.is_starred && <Star size={14} className="text-[#FAEBD7] fill-[#FAEBD7]/20" />}
																	{p.is_shared && <Users size={14} className="text-blue-400" title="Shared with others" />}
																	{p.is_public && <Globe size={14} className="text-emerald-400" title="Published" />}
																</div>
															</div>
															{viewMode === 'grid' && (
																<button
																	onClick={(e) => { e.stopPropagation(); handleContextMenu(e, p, 'my') }}
																	className="p-1.5 hover:bg-foreground/10 rounded-lg text-foreground/40 hover:text-foreground transition-all"
																>
																	<MoreVertical size={18} />
																</button>
															)}
														</div>
														<div className="flex items-center gap-4 text-[10px] text-foreground/50 mt-1">
															<span className="flex items-center gap-1"><Clock size={12} /> {new Date(p.updated_at).toLocaleDateString()}</span>
															{viewMode === 'list' && p.folder && (
																<span className="flex items-center gap-1 bg-foreground/5 px-2 py-0.5 rounded-full capitalize">
																	<Folder size={10} /> {p.folder}
																</span>
															)}
														</div>
													</div>
												</div>

												<div className="flex items-center gap-2">
													{viewMode === 'list' && (
														<button
															onClick={(e) => { e.stopPropagation(); handleContextMenu(e, p, 'my') }}
															className="p-2.5 hover:bg-foreground/10 rounded-xl text-foreground/40 hover:text-foreground transition-all ml-1 sm:ml-4"
															title="More actions"
														>
															<MoreVertical size={20} />
														</button>
													)}
													{viewMode === 'grid' && (
														<Link 
															href={`/canvas/${p.id}`} 
															className="mt-6 block w-full py-3 bg-foreground/10 rounded-xl font-bold text-sm text-center group-hover:bg-foreground group-hover:text-background transition-all"
														>
															Open Workspace
														</Link>
													)}
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						)
					})}
				</div>
			)}
		</section>
	)


	return (
		<div className="dashboard-grid bg-background text-foreground font-sans w-full max-w-full overflow-x-hidden">
			<DashboardSidebar 
				onNew={handleNewCanvas} 
				activeTab={activeTab} 
				onTabChange={handleTabChange}
				user={user}
				profile={profile}
				groupedPipelines={groupedPipelines}
				onSignOut={handleSignOut}
				loading={loading}
				isOpen={isSidebarOpen}
				setIsOpen={setIsSidebarOpen}
				className="dashboard-sidebar shadow-xl z-20" 
			/>
			
			<DashboardTopBar 
				user={user} 
				profile={profile} 
				searchQuery={searchQuery} 
				setSearchQuery={setSearchQuery} 
				sortBy={sortBy}
				setSortBy={setSortBy}
				sortOrder={sortOrder}
				setSortOrder={setSortOrder}
				toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
				className="dashboard-topbar"
			/>

			<main className="dashboard-main no-scrollbar">
				<div className="max-w-7xl mx-auto">
					{/* Suggested Section - Google Drive Style - Only on Home */}
					{activeTab === 'Home' && !searchQuery && (
						<section className="mb-10">
							<h2 className="text-sm font-medium text-foreground/60 mb-4 px-1 uppercase tracking-wider">Suggested</h2>
							<div className="flex flex-nowrap sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 h-full scroll-smooth scroll-pl-4">
								{recentlyEdited.slice(0, 4).map(p => (
									<div 
										key={`suggested-${p.id}`}
										onContextMenu={(e) => handleContextMenu(e, p, 'my')}
										className="group bg-background border border-foreground/10 rounded-xl hover:border-[#FAEBD7]/50 hover:bg-[#FAEBD7]/10 transition-all p-3 sm:p-4 relative cursor-pointer overflow-hidden shadow-sm hover:shadow-md border-l-4 border-l-[#FAEBD7] min-w-0 flex-none w-[85%] sm:w-auto"
									>
										<div className="h-28 mb-3 overflow-hidden rounded-lg pointer-events-none">
											<PipelineThumbnail nodes={p.nodes} edges={p.edges} />
										</div>
										<div className="flex items-center gap-2">
											<Folder size={16} className="text-amber-400 shrink-0" />
											<h3 className="text-sm font-medium truncate">{p.name || 'Untitled Pipeline'}</h3>
										</div>
										<p className="text-[10px] text-foreground/40 mt-1 flex items-center gap-1">
											<Clock size={10} /> Edited {new Date(p.updated_at).toLocaleDateString()}
										</p>
										<Link href={`/canvas/${p.id}`} className="absolute inset-0 z-10" />
									</div>
								))}
							</div>
						</section>
					)}

					{/* Standard Dashboard Content */}
					<header className="flex flex-row justify-between items-center gap-4 mb-6">
						<h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#FAEBD7]">
							{searchQuery ? `Search results for "${searchQuery}"` : activeTab}
						</h1>
						
						<div className="flex items-center gap-2 bg-foreground/5 p-1 rounded-lg self-end sm:self-auto">
							<button
								onClick={() => setViewMode('grid')}
								className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-background shadow-sm text-foreground font-bold' : 'text-foreground/40 hover:text-foreground'}`}
								title="Grid View"
							>
								<Grid size={18} />
							</button>
							<button
								onClick={() => setViewMode('list')}
								className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-background shadow-sm text-foreground font-bold' : 'text-foreground/40 hover:text-foreground'}`}
								title="List View"
							>
								<List size={18} />
							</button>
						</div>
					</header>

					{/* Tab Content Rendering */}
					<div className="min-h-[400px]">
						{loading ? (
							<DashboardMainSkeleton />
						) : (
							<>
								{/* My Drive / Home Tab */}
								{activeTab === 'Home' && renderHomeTab()}

								{/* Shared Tab */}
								{activeTab === 'Shared with me' && renderSharedTab()}

								{/* Recent Tab */}
								{activeTab === 'Recent' && renderFlatList(recentlyEdited, 'clock')}

								{/* Starred Tab */}
								{activeTab === 'Starred' && renderFlatList(filteredMyPipelines.filter(p => p.is_starred), 'star')}
							</>
						)}
					</div>

				{/* Context Menu */}
				{contextMenu && (
					<div 
						className="fixed z-50 min-w-[200px] bg-background border border-foreground/10 rounded-2xl shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-100"
						style={{ top: contextMenu.y, left: contextMenu.x }}
						onContextMenu={(e) => e.preventDefault()}
					>
						<div className="px-4 pb-2 mb-2 border-b border-foreground/5 flex items-center justify-between gap-2">
							<span className="text-xs font-bold text-foreground/50 truncate">
								{contextMenu.pipeline?.name || 'Pipeline'}
							</span>
							{contextMenu.type === 'my' && (
								<button
									onClick={(e) => { e.stopPropagation(); handleStarPipeline(contextMenu.pipeline); setContextMenu(null) }}
									className={`p-1 -mr-1 transition-colors ${contextMenu.pipeline.is_starred ? 'text-amber-400 hover:text-amber-300' : 'text-foreground/40 hover:text-amber-400'}`}
									title={contextMenu.pipeline.is_starred ? 'Unstar' : 'Star'}
								>
									{contextMenu.pipeline.is_starred ? <StarOff size={14} /> : <Star size={14} />}
								</button>
							)}
						</div>
						
						{contextMenu.type === 'my' ? (
							<>
								<button onClick={() => { router.push(`/canvas/${contextMenu.pipeline.id}`); setContextMenu(null) }} className="w-full text-left px-4 py-2 text-sm hover:bg-foreground/5 flex items-center gap-3 transition-colors text-foreground/80 hover:text-foreground">
									<ExternalLink size={16} /> Open
								</button>
								<button onClick={() => { handleStartRename(contextMenu.pipeline); setContextMenu(null) }} className="w-full text-left px-4 py-2 text-sm hover:bg-foreground/5 flex items-center gap-3 transition-colors text-foreground/80 hover:text-foreground">
									<Edit2 size={16} /> Rename
								</button>
								<button onClick={(e) => { 
									e.stopPropagation(); 
									setMovingPipelineId(contextMenu.pipeline.id); 
									setContextMenu(null) 
								}} className="w-full text-left px-4 py-2 text-sm hover:bg-foreground/5 flex items-center gap-3 transition-colors text-foreground/80 hover:text-foreground">
									<Folder size={16} /> Move to folder
								</button>
								<button onClick={() => { handleDuplicate(contextMenu.pipeline); setContextMenu(null) }} className="w-full text-left px-4 py-2 text-sm hover:bg-emerald-500/10 flex items-center gap-3 transition-colors text-emerald-400/80 hover:text-emerald-400">
									<Copy size={16} /> Duplicate
								</button>
								<button onClick={() => { openShareModal(contextMenu.pipeline); setContextMenu(null) }} className="w-full text-left px-4 py-2 text-sm hover:bg-blue-500/10 flex items-center gap-3 transition-colors text-blue-400/80 hover:text-blue-400">
									<Share2 size={16} /> Share
								</button>
								<button onClick={() => { openPublishModal(contextMenu.pipeline); setContextMenu(null) }} className="w-full text-left px-4 py-2 text-sm hover:bg-amber-400/10 flex items-center gap-3 transition-colors text-amber-400/80 hover:text-amber-400">
									<Users size={16} /> Publish to Community
								</button>
								<div className="h-px bg-foreground/5 my-1" />
								<button onClick={() => { setConfirmDelete({ type: 'pipeline', id: contextMenu.pipeline.id, name: contextMenu.pipeline.name }); setContextMenu(null) }} className="w-full text-left px-4 py-2 text-sm hover:bg-red-500/20 text-red-400 hover:text-red-300 flex items-center gap-3 transition-colors font-bold">
									<Trash2 size={16} /> Delete
								</button>
							</>
						) : (
							<>
								<button onClick={() => { router.push(`/canvas/${contextMenu.pipeline.id}?access=${contextMenu.pipeline.share_permission === 'edit' ? 'edit' : 'view'}`); setContextMenu(null) }} className="w-full text-left px-4 py-2 text-sm hover:bg-foreground/5 flex items-center gap-3 transition-colors text-foreground/80 hover:text-foreground">
									<ExternalLink size={16} /> Open
								</button>
								{contextMenu.pipeline.share_permission !== 'edit' && (
									<button onClick={() => { handleCreateCopy(contextMenu.pipeline); setContextMenu(null) }} className="w-full text-left px-4 py-2 text-sm hover:bg-blue-500/10 flex items-center gap-3 transition-colors text-blue-400/80 hover:text-blue-400">
										<Copy size={16} /> Create Editable Copy
									</button>
								)}
							</>
						)}
					</div>
				)}

				{/* Publish to Community Modal */}
				{publishModal && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
						<div className="bg-background border border-foreground/20 rounded-3xl p-8 shadow-2xl max-w-md w-full">
							<h3 className="text-xl font-bold mb-2 flex items-center gap-2"><Users size={20} className="text-amber-400" /> Publish Pipeline</h3>
							<p className="text-foreground/50 text-sm mb-6">Make "{publishModal.name}" visible to the community gallery.</p>
							
							<div className="space-y-4 mb-8">
								<div>
									<label className="block text-xs font-bold text-foreground/50 uppercase tracking-wider mb-2">Description</label>
									<textarea 
										value={publishDesc}
										onChange={(e) => setPublishDesc(e.target.value)}
										className="w-full bg-foreground/5 border border-foreground/10 rounded-xl p-3 text-sm outline-none focus:border-foreground/30 min-h-[100px]"
										placeholder="What does this pipeline do?"
									/>
								</div>
								<div>
									<label className="block text-xs font-bold text-foreground/50 uppercase tracking-wider mb-2">Tags (Comma-separated)</label>
									<input 
										type="text"
										value={publishTags}
										onChange={(e) => setPublishTags(e.target.value)}
										className="w-full bg-foreground/5 border border-foreground/10 rounded-xl p-3 text-sm outline-none focus:border-foreground/30"
										placeholder="e.g. nlp, yolo, computer vision"
									/>
								</div>
							</div>

							<div className="flex gap-3">
								<button onClick={() => setPublishModal(null)} className="flex-1 py-3 bg-foreground/5 hover:bg-foreground/10 rounded-xl font-bold transition-colors">Cancel</button>
								<button onClick={submitPublishToCommunity} className="flex-1 py-3 bg-amber-400 hover:bg-amber-300 text-black rounded-xl font-bold transition-colors shadow-[0_0_20px_rgba(251,191,36,0.3)] hover:shadow-[0_0_30px_rgba(251,191,36,0.5)]">Publish Now</button>
							</div>
						</div>
					</div>
				)}

				{/* Confirmation Modal */}
				{confirmDelete.type && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
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
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
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
								<label className="block text-xs font-bold uppercase tracking-wider text-foreground/60 mb-2">Permission</label>
								<CustomDropdown
									value={sharePermission}
									onChange={setSharePermission}
									options={permissionOptions}
									variant="input"
									label="Select Access Level"
								/>
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
			</main>
		</div>
	)
}

export default DashboardPage