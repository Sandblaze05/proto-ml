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

const PipelineThumbnail = React.memo(({ nodes = [], edges = [] }) => {
	if (!nodes || nodes.length === 0) {
		return (
			<div className="w-full h-32 bg-foreground/[0.03] rounded-xl mb-4 relative overflow-hidden flex items-center justify-center group-hover:bg-foreground/[0.05] transition-colors border border-foreground/5">
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

export default PipelineThumbnail
