'use client'

import React from 'react'
import { Layout } from 'lucide-react'

const Shimmer = () => (
	<div className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-foreground/5 to-transparent animate-shimmer" />
)

const CanvasSkeleton = () => {
	return (
		<div className="w-full h-screen bg-background relative overflow-hidden">
			<style jsx global>{`
				@keyframes shimmer {
					0% { transform: translateX(-100%); }
					100% { transform: translateX(100%); }
				}
				.animate-shimmer {
					animation: shimmer 1.5s infinite;
					will-change: transform;
				}
                .canvas-dots {
                    background-image: radial-gradient(circle, rgba(250, 235, 215, 0.05) 1px, transparent 1px);
                    background-size: 20px 20px;
                }
			`}</style>
            
            {/* Canvas Background Dots */}
            <div className="absolute inset-0 canvas-dots" />

			{/* Sidebar Skeleton (DashboardNav) */}
			<div className="fixed left-4 top-1/2 -translate-y-[50%] rounded-2xl border-3 border-foreground/20 h-[680px] bg-background/90 backdrop-blur-md w-[400px] overflow-hidden shadow-2xl z-50">
				<div className="p-6">
					<div className="flex items-center justify-between mb-4 pb-4 border-b border-foreground/10">
						<div className="h-8 w-48 bg-foreground/10 rounded relative overflow-hidden">
							<Shimmer />
						</div>
						<div className="flex gap-2">
							<div className="w-6 h-6 bg-foreground/10 rounded relative overflow-hidden">
								<Shimmer />
							</div>
							<div className="w-6 h-6 bg-foreground/10 rounded relative overflow-hidden">
								<Shimmer />
							</div>
						</div>
					</div>
					<div className="space-y-4">
						{[1, 2, 3, 4, 5, 6].map((i) => (
							<div key={i} className="h-10 w-full bg-foreground/5 rounded-xl relative overflow-hidden">
								<Shimmer />
							</div>
						))}
					</div>
				</div>
			</div>

			{/* Top Right Silhouettes (DashboardProfile) */}
			<div className="fixed top-3 right-6 flex items-start gap-3 z-50">
				<div className="w-56 h-10 rounded-full border-2 border-foreground/20 bg-background/95 relative overflow-hidden">
					<Shimmer />
				</div>
				<div className="w-10 h-10 rounded-full bg-background/95 border-2 border-foreground/20 relative overflow-hidden">
					<Shimmer />
				</div>
			</div>

			{/* Floating Node Silhouettes */}
			<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
				<div className="relative w-full h-full">
					{/* Node 1 */}
					<div className="absolute top-[20%] left-[55%] w-64 h-80 bg-background/80 border-2 border-foreground/10 rounded-2xl shadow-xl overflow-hidden">
						<div className="h-12 bg-foreground/5 border-b border-foreground/10 px-4 flex items-center justify-between">
							<div className="h-3 w-20 bg-foreground/10 rounded relative overflow-hidden"><Shimmer /></div>
							<div className="h-4 w-4 bg-foreground/10 rounded relative overflow-hidden"><Shimmer /></div>
						</div>
						<div className="p-4 space-y-4">
							<div className="h-2 w-full bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
							<div className="h-2 w-3/4 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
							<div className="h-32 w-full bg-foreground/5 rounded-lg relative overflow-hidden mt-4"><Shimmer /></div>
						</div>
                        <div className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-foreground/3 to-transparent animate-shimmer" />
					</div>

					{/* Node 2 */}
					<div className="absolute top-[45%] left-[40%] w-60 h-48 bg-background/80 border-2 border-foreground/10 rounded-2xl shadow-xl overflow-hidden">
						<div className="h-10 bg-foreground/5 border-b border-foreground/10 px-4 flex items-center">
							<div className="h-3 w-24 bg-foreground/10 rounded relative overflow-hidden"><Shimmer /></div>
						</div>
						<div className="p-4 space-y-3">
							<div className="h-8 w-full bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
							<div className="h-8 w-full bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
						</div>
                        <div className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-foreground/3 to-transparent animate-shimmer" />
					</div>
				</div>
			</div>

			{/* Bottom Left Button Silhouette */}
			<div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-6 py-3 bg-foreground/10 rounded-full w-40 overflow-hidden">
                <div className="w-4 h-4 bg-foreground/10 rounded relative overflow-hidden"><Shimmer /></div>
                <div className="h-3 w-20 bg-foreground/10 rounded relative overflow-hidden ml-2"><Shimmer /></div>
                <Shimmer />
			</div>
		</div>
	)
}

export default CanvasSkeleton
