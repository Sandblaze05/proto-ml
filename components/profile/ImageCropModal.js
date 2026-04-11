'use client'

import React, { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, RotateCcw, ZoomIn } from 'lucide-react'
import getCroppedImg from '@/lib/utils/cropImage'

const ImageCropModal = ({ image, onCropComplete, onCancel }) => {
	const [crop, setCrop] = useState({ x: 0, y: 0 })
	const [zoom, setZoom] = useState(1)
	const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)

	const onCropChange = (crop) => {
		setCrop(crop)
	}

	const onZoomChange = (zoom) => {
		setZoom(zoom)
	}

	const onCropAreaComplete = useCallback((_croppedArea, croppedAreaPixels) => {
		setCroppedAreaPixels(croppedAreaPixels)
	}, [])

	const handleSave = async () => {
		try {
			const croppedImage = await getCroppedImg(image, croppedAreaPixels)
			onCropComplete(croppedImage)
		} catch (e) {
			console.error(e)
		}
	}

	return (
		<div className="fixed inset-0 z-100 flex items-center justify-center p-6">
			<motion.div 
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				onClick={onCancel}
				className="absolute inset-0 bg-black/80 backdrop-blur-sm"
			/>
			
			<motion.div 
				initial={{ scale: 0.9, opacity: 0, y: 20 }}
				animate={{ scale: 1, opacity: 1, y: 0 }}
				exit={{ scale: 0.9, opacity: 0, y: 20 }}
				className="relative w-full max-w-2xl bg-background border border-foreground/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col"
			>
				{/* Header */}
				<div className="flex items-center justify-between p-6 border-b border-foreground/5">
					<h2 className="text-xl font-black">Crop Profile Photo</h2>
					<button 
						onClick={onCancel}
						className="p-2 rounded-xl hover:bg-foreground/5 text-foreground/30 hover:text-foreground transition-all"
					>
						<X size={20} />
					</button>
				</div>

				{/* Cropper Area */}
				<div className="relative h-[400px] bg-black/20">
					<Cropper
						image={image}
						crop={crop}
						zoom={zoom}
						aspect={1}
						onCropChange={onCropChange}
						onCropComplete={onCropAreaComplete}
						onZoomChange={onZoomChange}
						cropShape="round"
						showGrid={false}
					/>
				</div>

				{/* Controls */}
				<div className="p-8 space-y-6 bg-background">
					<div className="flex items-center gap-6">
						<div className="flex items-center gap-3 text-foreground/40">
							<ZoomIn size={18} />
							<input
								type="range"
								value={zoom}
								min={1}
								max={3}
								step={0.1}
								aria-labelledby="Zoom"
								onChange={(e) => setZoom(parseFloat(e.target.value))}
								className="w-48 h-1.5 bg-foreground/5 rounded-full appearance-none cursor-pointer accent-amber-400"
							/>
						</div>
						<button 
							onClick={() => { setZoom(1); setCrop({ x: 0, y: 0 }); }}
							className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground/20 hover:text-foreground transition-all"
						>
							<RotateCcw size={14} />
							Reset
						</button>
					</div>

					<div className="flex items-center justify-end gap-3">
						<button 
							onClick={onCancel}
							className="px-6 py-3 rounded-2xl text-sm font-bold text-foreground/40 hover:text-foreground transition-all"
						>
							Cancel
						</button>
						<button 
							onClick={handleSave}
							className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-amber-400 text-black font-bold shadow-lg shadow-amber-400/20 hover:opacity-90 transition-all"
						>
							<Check size={18} />
							Apply Crop
						</button>
					</div>
				</div>
			</motion.div>
		</div>
	)
}

export default ImageCropModal
