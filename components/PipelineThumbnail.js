import React from 'react'
import { Layout } from 'lucide-react'

export const THUMBNAIL_COLOR_MAP = {
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

export const TYPE_LABEL_MAP = {
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

const PREVIEW_WIDTH = 320
const PREVIEW_HEIGHT = 128
const PREVIEW_PADDING = 16
const THUMB_NODE_WIDTH = 86
const THUMB_NODE_HEIGHT = 30

const getNodeSize = (node) => ({
	width: node.width || node.measured?.width || 180,
	height: node.height || node.measured?.height || 80,
})

const EmptyThumbnail = ({ message = null }) => (
	<div className="w-full h-32 bg-foreground/[0.03] rounded-xl mb-4 relative overflow-hidden flex items-center justify-center group-hover:bg-foreground/[0.05] transition-colors border border-foreground/5">
		<div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
		<div className="relative z-10 flex flex-col items-center gap-2 text-foreground/20">
			<Layout size={24} />
			{message && (
				<span className="text-[9px] font-bold uppercase tracking-widest text-foreground/30">
					{message}
				</span>
			)}
		</div>
	</div>
)

const PipelineThumbnail = React.memo(function PipelineThumbnail({ nodes = [], edges = [] }) {
	if (!nodes || nodes.length === 0) {
		return <EmptyThumbnail />
	}

	const validNodes = nodes.filter(n =>
		!['annotationNode', 'shapeNode', 'frameNode', 'textNode'].includes(n.type) &&
		n.position &&
		typeof n.position.x === 'number' &&
		typeof n.position.y === 'number'
	)

	if (validNodes.length === 0) return <EmptyThumbnail message="Canvas notes only" />

	const centers = validNodes.map((node) => {
		const size = getNodeSize(node)
		return {
			id: node.id,
			x: node.position.x + size.width / 2,
			y: node.position.y + size.height / 2,
		}
	})

	const minX = Math.min(...centers.map(n => n.x))
	const minY = Math.min(...centers.map(n => n.y))
	const maxX = Math.max(...centers.map(n => n.x))
	const maxY = Math.max(...centers.map(n => n.y))

	const graphWidth = Math.max(maxX - minX, 1)
	const graphHeight = Math.max(maxY - minY, 1)
	const availableWidth = PREVIEW_WIDTH - PREVIEW_PADDING * 2 - THUMB_NODE_WIDTH
	const availableHeight = PREVIEW_HEIGHT - PREVIEW_PADDING * 2 - THUMB_NODE_HEIGHT
	const scale = Math.min(availableWidth / graphWidth, availableHeight / graphHeight, 1)
	const usedWidth = graphWidth * scale
	const usedHeight = graphHeight * scale
	const offsetX = PREVIEW_PADDING + THUMB_NODE_WIDTH / 2 + Math.max(availableWidth - usedWidth, 0) / 2
	const offsetY = PREVIEW_PADDING + THUMB_NODE_HEIGHT / 2 + Math.max(availableHeight - usedHeight, 0) / 2

	const thumbnailCenters = new Map(
		centers.map((node) => [
			node.id,
			{
				x: offsetX + (node.x - minX) * scale,
				y: offsetY + (node.y - minY) * scale,
			},
		])
	)

	return (
		<div className="w-full h-32 bg-foreground/[0.03] rounded-xl mb-4 relative overflow-hidden group-hover:bg-foreground/[0.05] transition-colors border border-foreground/5">
			<div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '6px 6px' }} />

			<div className="relative w-full h-full flex items-center justify-center">
				<div
					className="relative"
					style={{
						width: '100%',
						height: PREVIEW_HEIGHT,
					}}
				>
					<svg
						className="absolute inset-0 overflow-visible pointer-events-none opacity-60"
						viewBox={`0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`}
						preserveAspectRatio="none"
						style={{ width: '100%', height: '100%' }}
					>
						{edges.map((edge, i) => {
							const source = thumbnailCenters.get(edge.source)
							const target = thumbnailCenters.get(edge.target)
							if (!source || !target) return null

							const dx = Math.max(Math.abs(target.x - source.x) * 0.4, 16)
							const sx = source.x
							const sy = source.y
							const tx = target.x
							const ty = target.y

							return (
								<path
									key={i}
									d={`M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`}
									stroke="currentColor"
									strokeWidth={1.2}
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
						const typeLabel = TYPE_LABEL_MAP[type] || TYPE_LABEL_MAP[node.type] || 'NODE'

						const center = thumbnailCenters.get(node.id)
						if (!center) return null
						const left = `${(center.x / PREVIEW_WIDTH) * 100}%`
						const top = `${(center.y / PREVIEW_HEIGHT) * 100}%`

						return (
							<div
								key={i}
								className="absolute rounded-md border shadow-sm px-2 py-1 flex flex-col justify-center gap-0.5 overflow-hidden"
								style={{
									left,
									top,
									transform: 'translate(-50%, -50%)',
									width: `${(THUMB_NODE_WIDTH / PREVIEW_WIDTH) * 100}%`,
									minWidth: 66,
									maxWidth: 118,
									height: THUMB_NODE_HEIGHT,
									borderColor: `${color}80`,
									backgroundColor: `${color}40`,
									backdropFilter: 'blur(4px)'
								}}
							>
								<div className="flex items-center gap-1 min-w-0">
									<div
										className="w-2 h-2 rounded-sm flex-shrink-0"
										style={{ backgroundColor: color }}
									/>
									<span className="text-[8px] leading-none font-bold text-foreground truncate uppercase">
										{label}
									</span>
								</div>
								<div
									className="text-[5px] leading-none font-bold opacity-60 tracking-widest truncate pl-3"
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
})

export default PipelineThumbnail
