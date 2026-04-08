'use client'

import React from 'react'

const Shimmer = () => (
	<div className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-foreground/5 to-transparent animate-shimmer" />
)

const CommunitySkeleton = () => {
	return (
		<div className="min-h-screen bg-background text-foreground font-mono p-8">
			<style jsx global>{`
				@keyframes shimmer {
					0% { transform: translateX(-100%); }
					100% { transform: translateX(100%); }
				}
				.animate-shimmer {
					animation: shimmer 1.5s infinite;
					will-change: transform;
				}
			`}</style>
            
			<div className="max-w-6xl mx-auto">
				{/* Header Skeleton */}
				<header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-4">
					<div>
						<div className="h-10 w-64 bg-foreground/10 rounded relative overflow-hidden">
							<Shimmer />
						</div>
						<div className="h-4 w-96 bg-foreground/5 rounded relative overflow-hidden mt-3">
							<Shimmer />
						</div>
					</div>
					<div className="h-10 w-40 bg-foreground/5 rounded-full relative overflow-hidden">
						<Shimmer />
					</div>
				</header>

				{/* Hero Section Skeleton */}
				<div className="mb-12">
					<div className="w-full h-96 bg-foreground/5 border border-foreground/10 rounded-4xl relative overflow-hidden">
						<div className="p-12 flex flex-col justify-center h-full max-w-2xl space-y-6">
                            <div className="h-12 w-3/4 bg-foreground/10 rounded-xl relative overflow-hidden"><Shimmer /></div>
                            <div className="h-6 w-full bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
                            <div className="h-6 w-5/6 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
                            <div className="flex gap-4 pt-4">
                                <div className="h-14 w-48 bg-amber-400/20 rounded-2xl relative overflow-hidden"><Shimmer /></div>
                                <div className="h-14 w-48 bg-foreground/5 rounded-2xl relative overflow-hidden"><Shimmer /></div>
                            </div>
                        </div>
                        <Shimmer />
					</div>
				</div>

				{/* Category Bar Skeleton */}
				<div className="flex items-center gap-4 mb-10 overflow-hidden">
					{[1, 2, 3, 4, 5, 6].map(i => (
						<div key={i} className="h-10 w-28 bg-foreground/5 rounded-full relative overflow-hidden shrink-0">
							<Shimmer />
						</div>
					))}
				</div>

				{/* Search and Sort Skeleton */}
				<div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-foreground/5 p-4 rounded-2xl border border-foreground/10">
					<div className="relative w-full md:w-1/2">
						<div className="h-12 w-full bg-background border border-foreground/10 rounded-xl relative overflow-hidden">
							<Shimmer />
						</div>
					</div>
					<div className="h-10 w-48 bg-background border border-foreground/10 rounded-xl relative overflow-hidden">
						<Shimmer />
					</div>
				</div>

				{/* Grid Skeleton */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{[1, 2, 3, 4, 5, 6].map(i => (
						<div key={i} className="bg-foreground/5 border border-foreground/10 rounded-2xl p-6 flex flex-col h-[400px] relative overflow-hidden">
							{/* Thumbnail Placeholder */}
							<div className="w-full h-48 bg-foreground/10 rounded-xl relative overflow-hidden mb-4">
								<Shimmer />
							</div>
							
							<div className="space-y-3 flex-1">
								<div className="flex justify-between items-center">
									<div className="h-6 w-2/3 bg-foreground/10 rounded relative overflow-hidden"><Shimmer /></div>
									<div className="h-4 w-10 bg-amber-400/10 rounded relative overflow-hidden"><Shimmer /></div>
								</div>
								<div className="h-4 w-1/2 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
								<div className="space-y-2 pt-2">
									<div className="h-3 w-full bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
									<div className="h-3 w-4/5 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
								</div>
							</div>

							{/* Action Bar Skeleton */}
							<div className="mt-6 flex items-center justify-between border-t border-foreground/10 pt-4">
								<div className="flex gap-3">
									<div className="h-4 w-12 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
									<div className="h-4 w-12 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
								</div>
								<div className="h-9 w-24 bg-foreground/10 rounded-xl relative overflow-hidden"><Shimmer /></div>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

export default CommunitySkeleton
