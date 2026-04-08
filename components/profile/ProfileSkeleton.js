'use client'

import React from 'react'

const Shimmer = () => (
	<div className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-foreground/5 to-transparent animate-shimmer" />
)

const ProfileSkeleton = () => {
	return (
		<div className="min-h-screen bg-background text-foreground font-sans">
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

			{/* Nav Skeleton */}
			<nav className="relative z-50 flex items-center justify-between px-8 h-16 border-b border-foreground/5 bg-background/40 backdrop-blur-xl">
				<div className="h-4 w-32 bg-foreground/5 rounded relative overflow-hidden">
					<Shimmer />
				</div>
				<div className="h-4 w-24 bg-foreground/5 rounded relative overflow-hidden">
					<Shimmer />
				</div>
			</nav>

			<main className="relative z-10 max-w-7xl mx-auto px-8 py-16">
				<div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-20">
					
					{/* Left Column: Profile Silhouette */}
					<aside className="space-y-10">
						<div className="space-y-6">
							{/* Large Avatar Silhouette */}
							<div className="w-48 h-48 rounded-full border-4 border-foreground/10 bg-background p-1 overflow-hidden shadow-2xl relative">
								<div className="w-full h-full bg-foreground/5 rounded-full relative overflow-hidden">
									<Shimmer />
								</div>
							</div>

							<div className="space-y-3">
								<div className="h-10 w-48 bg-foreground/10 rounded relative overflow-hidden">
									<Shimmer />
								</div>
								<div className="h-6 w-32 bg-amber-400/10 rounded relative overflow-hidden">
									<Shimmer />
								</div>
							</div>

							<div className="space-y-2 max-w-sm">
								<div className="h-4 w-full bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
								<div className="h-4 w-5/6 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
								<div className="h-4 w-4/6 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
							</div>

							{/* Social/Links Silhouette */}
							<div className="space-y-4 pt-4">
								{[1, 2, 3].map(i => (
									<div key={i} className="flex items-center gap-3">
										<div className="w-5 h-5 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
										<div className="h-4 w-40 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
									</div>
								))}
							</div>
						</div>
					</aside>

					{/* Right Column: Workflows Silhouette */}
					<section className="space-y-12">
						<header className="flex items-center justify-between pb-6 border-b border-foreground/5">
							<div className="h-8 w-64 bg-foreground/5 rounded relative overflow-hidden">
								<Shimmer />
							</div>
							<div className="h-4 w-40 bg-foreground/5 rounded relative overflow-hidden">
								<Shimmer />
							</div>
						</header>

						<div className="bg-white/2 border border-white/5 rounded-3xl overflow-hidden shadow-2xl divide-y divide-white/5">
							{[1, 2, 3, 4].map(i => (
								<div key={i} className="p-6 space-y-4">
									<div className="flex justify-between items-center">
										<div className="space-y-2 flex-1">
											<div className="h-5 w-1/2 bg-foreground/10 rounded relative overflow-hidden"><Shimmer /></div>
											<div className="h-4 w-1/4 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
										</div>
										<div className="w-24 h-10 bg-foreground/5 rounded-xl relative overflow-hidden"><Shimmer /></div>
									</div>
								</div>
							))}
						</div>
					</section>

				</div>
			</main>
		</div>
	)
}

export default ProfileSkeleton
