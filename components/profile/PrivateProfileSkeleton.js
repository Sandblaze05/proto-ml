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
				<div className="w-full px-6 lg:px-10 xl:px-14 py-12">
					<div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-14 xl:gap-20">

						<div className="lg:sticky lg:top-24 lg:self-start order-1 lg:order-1 space-y-4">
							<div className="flex items-center justify-between">
								<div />
								<div className="h-8 w-28 bg-foreground/5 rounded-xl relative overflow-hidden">
									<Shimmer />
								</div>
								<div className="h-8 w-24 bg-foreground/5 rounded-xl relative overflow-hidden">
									<Shimmer />
								</div>
							</div>

							<div className="w-full flex justify-center py-2 overflow-visible">
								<div className="w-full max-w-[700px] aspect-[741/425] rounded-2xl bg-foreground/2 border border-foreground/8 relative overflow-hidden">
									<div className="absolute inset-0 bg-linear-to-br from-amber-400/10 to-orange-500/10" />
									<div className="absolute left-0 top-0 bottom-0 w-[42%] border-r border-dashed border-foreground/10" />
									<div className="absolute inset-0 flex items-center justify-center">
										<div className="h-10 w-32 bg-foreground/10 rounded relative overflow-hidden">
											<Shimmer />
										</div>
									</div>
									<Shimmer />
								</div>
							</div>
						</div>

						<div className="space-y-10 order-2 lg:order-2">
							<section>
								<div className="flex items-center gap-3 mb-5">
									<div className="h-3 w-4 bg-foreground/10 rounded relative overflow-hidden"><Shimmer /></div>
									<div className="h-3 w-20 bg-foreground/10 rounded relative overflow-hidden"><Shimmer /></div>
									<div className="flex-1 h-px bg-foreground/[0.07]" />
								</div>
								<div className="space-y-6">
									<div className="space-y-2">
										<div className="h-3 w-24 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
										<div className="h-12 w-full bg-foreground/4 border border-foreground/8 rounded-xl relative overflow-hidden">
											<Shimmer />
										</div>
									</div>
									<div className="space-y-2">
										<div className="h-3 w-24 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
										<div className="h-12 w-full bg-foreground/4 border border-foreground/8 rounded-xl relative overflow-hidden">
											<Shimmer />
										</div>
									</div>
									<div className="space-y-2">
										<div className="h-3 w-24 bg-foreground/5 rounded relative overflow-hidden"><Shimmer /></div>
										<div className="h-24 w-full bg-foreground/4 border border-foreground/8 rounded-xl relative overflow-hidden">
											<Shimmer />
										</div>
									</div>
								</div>
							</section>

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