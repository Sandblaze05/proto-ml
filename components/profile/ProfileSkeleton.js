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
			<nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 h-16 border-b border-white/[0.04] bg-background/60 backdrop-blur-xl">
				<div className="h-4 w-32 bg-foreground/5 rounded relative overflow-hidden">
					<Shimmer />
				</div>
				<div className="h-8 w-24 bg-foreground/5 rounded-xl relative overflow-hidden">
					<Shimmer />
				</div>
			</nav>

			{/* Banner Skeleton */}
			<div className="h-[280px] w-full bg-foreground/[0.03] relative overflow-hidden">
				<Shimmer />
			</div>

			<main className="relative z-10 max-w-7xl mx-auto px-8 -mt-24 pb-24">
				<div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-16">
					
					{/* Left Column: Profile Silhouette */}
					<aside className="space-y-10">
						<div className="space-y-8">
							{/* Large Avatar Silhouette */}
							<div className="w-48 h-48 rounded-[32px] border-4 border-background bg-background p-1.5 overflow-hidden shadow-2xl relative">
								<div className="w-full h-full bg-foreground/[0.04] rounded-[24px] relative overflow-hidden">
									<Shimmer />
								</div>
							</div>

							<div className="space-y-3">
								<div className="h-10 w-48 bg-foreground/10 rounded relative overflow-hidden">
									<Shimmer />
								</div>
								<div className="h-6 w-32 bg-foreground/5 rounded relative overflow-hidden">
									<Shimmer />
								</div>
							</div>

							<div className="py-6 border-y border-foreground/5">
								<div className="flex gap-8">
									<div className="h-10 w-16 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
									<div className="h-10 w-16 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
									<div className="h-10 w-16 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
								</div>
							</div>

							<div className="space-y-3 max-w-sm">
								<div className="h-4 w-full bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
								<div className="h-4 w-5/6 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
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
					<section className="space-y-10 pt-8">
						<header className="flex items-center justify-between pb-6 border-b border-foreground/5">
							<div className="h-8 w-48 bg-foreground/5 rounded relative overflow-hidden">
								<Shimmer />
							</div>
							<div className="flex gap-3">
								<div className="h-10 w-48 bg-foreground/5 rounded-2xl relative overflow-hidden"><Shimmer /></div>
								<div className="h-10 w-32 bg-foreground/5 rounded-2xl relative overflow-hidden"><Shimmer /></div>
							</div>
						</header>

						<div className="bg-white/2 border border-white/5 rounded-[32px] overflow-hidden shadow-2xl divide-y divide-white/[0.03]">
							{[1, 2, 3, 4].map(i => (
								<div key={i} className="p-6 space-y-4">
									<div className="flex justify-between items-center">
										<div className="space-y-2 flex-1">
											<div className="h-5 w-1/3 bg-foreground/10 rounded relative overflow-hidden"><Shimmer /></div>
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
