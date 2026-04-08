'use client'

import React from 'react'

const Shimmer = () => (
	<div className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-foreground/5 to-transparent animate-shimmer" />
)

const PrivateProfileSkeleton = () => {
	return (
		<div className="min-h-screen bg-background text-foreground">
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

			{/* Navbar Skeleton */}
			<nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-14 border-b border-foreground/6 bg-background/90 backdrop-blur-sm">
				<div className="h-4 w-24 bg-foreground/5 rounded relative overflow-hidden">
					<Shimmer />
				</div>
				<div className="h-3 w-32 bg-foreground/10 rounded relative overflow-hidden">
					<Shimmer />
				</div>
				<div className="w-24" />
			</nav>

			<main className="pt-14 min-h-screen">
				<div className="max-w-5xl mx-auto px-6 py-12">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
						
						{/* Left Column: Preview Skeleton */}
						<div className="lg:sticky lg:top-24 lg:self-start space-y-3">
							<div className="h-3 w-20 bg-foreground/5 rounded relative overflow-hidden mb-3">
								<Shimmer />
							</div>
							<div className="rounded-2xl overflow-hidden border border-foreground/8 shadow-lg bg-foreground/2">
								<div className="h-28 w-full bg-foreground/10 relative overflow-hidden">
									<Shimmer />
								</div>
								<div className="px-6 pb-5">
									<div className="relative -mt-8 mb-4">
										<div className="w-16 h-16 rounded-xl border-[3px] border-background bg-foreground/10 relative overflow-hidden">
											<Shimmer />
										</div>
									</div>
									<div className="h-6 w-32 bg-foreground/10 rounded relative overflow-hidden mb-2"><Shimmer /></div>
									<div className="h-4 w-24 bg-amber-400/20 rounded relative overflow-hidden mb-4"><Shimmer /></div>
									
									<div className="space-y-2 mb-6">
										<div className="h-4 w-full bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
										<div className="h-4 w-5/6 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
									</div>

									<div className="space-y-2">
										<div className="h-4 w-40 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
										<div className="h-4 w-40 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
										<div className="h-4 w-40 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
										<div className="h-4 w-40 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
									</div>
								</div>
								
								<div className="px-6 py-4 border-t border-foreground/6 bg-foreground/1">
									<p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/20 mb-3">Banner colors</p>
									<div className="flex gap-2 flex-wrap">
										{[1, 2, 3, 4, 5, 6].map(i => (
											<div key={i} className="w-8 h-8 rounded-lg bg-foreground/5 relative overflow-hidden">
												<Shimmer />
											</div>
										))}
									</div>
								</div>
							</div>
						</div>

						{/* Right Column: Editor Skeleton */}
						<div className="space-y-10">
							{/* Section 01 */}
							<section>
								<div className="flex items-center gap-3 mb-5">
									<div className="h-3 w-4 bg-foreground/10 rounded relative overflow-hidden"><Shimmer /></div>
									<div className="h-3 w-20 bg-foreground/10 rounded relative overflow-hidden"><Shimmer /></div>
									<div className="flex-1 h-px bg-foreground/[0.07]" />
								</div>
								<div className="space-y-6">
									{[1, 2].map(i => (
										<div key={i} className="space-y-2">
											<div className="h-3 w-24 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
									<div className="h-12 w-full bg-foreground/4 border border-foreground/8 rounded-xl relative overflow-hidden">
												<Shimmer />
											</div>
										</div>
									))}
									<div className="space-y-2">
										<div className="h-3 w-24 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
										<div className="h-24 w-full bg-foreground/4 border border-foreground/8 rounded-xl relative overflow-hidden">
											<Shimmer />
										</div>
									</div>
								</div>
							</section>

							{/* Section 02 */}
							<section>
								<div className="flex items-center gap-3 mb-5">
									<div className="h-3 w-4 bg-foreground/10 rounded relative overflow-hidden"><Shimmer /></div>
									<div className="h-3 w-20 bg-foreground/10 rounded relative overflow-hidden"><Shimmer /></div>
									<div className="flex-1 h-px bg-foreground/[0.07]" />
								</div>
								<div className="space-y-3">
									<div className="h-12 w-full bg-foreground/4 border border-foreground/8 rounded-xl relative overflow-hidden">
										<Shimmer />
									</div>
									<div className="h-12 w-full bg-foreground/4 border border-foreground/8 rounded-xl relative overflow-hidden">
										<Shimmer />
									</div>
									<div className="h-12 w-full bg-foreground/4 border border-foreground/8 rounded-xl relative overflow-hidden">
										<Shimmer />
									</div>
									<div className="h-12 w-full bg-foreground/4 border border-foreground/8 rounded-xl relative overflow-hidden">
										<Shimmer />
									</div>
								</div>
							</section>

							<div className="h-12 w-40 bg-foreground rounded-xl relative overflow-hidden">
								<Shimmer />
							</div>
						</div>

					</div>
				</div>
			</main>
		</div>
	)
}

export default PrivateProfileSkeleton
