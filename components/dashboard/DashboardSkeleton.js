'use client'

import React from 'react'
import { Home, Users, Clock, Star, Folder, Plus, Search, HelpCircle, Settings, Bell, ChevronDown, Layout, Grid, List } from 'lucide-react'

const Shimmer = () => (
	<div className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-foreground/5 to-transparent animate-shimmer" />
)

const SkeletonBox = ({ className = '', children }) => (
	<div className={`relative overflow-hidden bg-foreground/5 rounded-xl ${className}`}>
		<Shimmer />
		{children}
	</div>
)

const DashboardSkeleton = () => {
	return (
		<div className="dashboard-grid bg-background text-foreground font-sans min-h-screen">
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
			
			{/* Sidebar Skeleton */}
			<aside className="dashboard-sidebar w-64 h-screen bg-background border-r border-foreground/5 flex flex-col shrink-0 overflow-hidden relative">
				<div className="flex-1 p-4">
					{/* Brand Header */}
					<div className="flex items-center gap-3 px-4 mb-10 mt-2">
						<div className="w-12 h-12 bg-foreground/5 rounded-xl overflow-hidden relative">
							<Shimmer />
						</div>
						<div className="h-6 w-24 bg-foreground/5 rounded-md relative overflow-hidden">
							<Shimmer />
						</div>
					</div>

					{/* New Canvas Button */}
					<div className="mb-8 px-2">
						<div className="h-[60px] w-full bg-foreground/10 rounded-2xl relative overflow-hidden">
							<Shimmer />
						</div>
					</div>

					{/* Nav Items */}
					<nav className="space-y-2 mt-4">
						{[1, 2, 3, 4].map((i) => (
							<div key={i} className="flex items-center gap-4 px-4 py-3 rounded-full">
								<div className="w-5 h-5 bg-foreground/5 rounded-md relative overflow-hidden">
									<Shimmer />
								</div>
								<div className="h-4 w-28 bg-foreground/5 rounded-md relative overflow-hidden">
									<Shimmer />
								</div>
							</div>
						))}
					</nav>

					<div className="h-px bg-foreground/5 my-6 mx-2" />

					{/* Folder section */}
					<div className="px-4 mb-2">
                        <div className="h-3 w-16 bg-foreground/5 rounded relative overflow-hidden">
                            <Shimmer />
                        </div>
                    </div>
					<nav className="space-y-1">
						{[1, 2].map((i) => (
							<div key={i} className="flex items-center gap-4 px-4 py-2 rounded-full">
								<div className="w-5 h-5 bg-foreground/5 rounded-md relative overflow-hidden">
									<Shimmer />
								</div>
								<div className="h-3 w-32 bg-foreground/5 rounded-md relative overflow-hidden">
									<Shimmer />
								</div>
							</div>
						))}
					</nav>
				</div>

				{/* Profile Section */}
				<div className="mt-auto bg-background border-t border-foreground/5 px-4 py-3 sticky bottom-0 z-10 w-full flex items-center gap-3">
					<div className="w-10 h-10 rounded-xl bg-foreground/5 relative overflow-hidden">
						<Shimmer />
					</div>
					<div className="flex flex-col gap-1 flex-1">
						<div className="h-3 w-20 bg-foreground/5 rounded relative overflow-hidden">
							<Shimmer />
						</div>
						<div className="h-2 w-12 bg-foreground/5 rounded relative overflow-hidden">
							<Shimmer />
						</div>
					</div>
                    <div className="w-8 h-8 bg-foreground/5 rounded-lg relative overflow-hidden">
                        <Shimmer />
                    </div>
				</div>
			</aside>

			{/* TopBar Skeleton */}
			<header className="dashboard-topbar h-16 flex items-center justify-between px-8 bg-background border-b border-foreground/5 sticky top-0 z-50">
				<div className="flex items-center gap-6 flex-1">
					<div className="max-w-xl w-full h-10 bg-foreground/5 rounded-full relative overflow-hidden">
						<Shimmer />
					</div>
					<div className="w-40 h-8 bg-foreground/5 rounded-full relative overflow-hidden">
						<Shimmer />
					</div>
				</div>
				<div className="flex items-center gap-2">
					{[1, 2, 3].map((i) => (
						<div key={i} className="w-9 h-9 bg-foreground/5 rounded-full relative overflow-hidden">
							<Shimmer />
						</div>
					))}
                    <div className="w-px h-6 bg-foreground/10 mx-2" />
                    <div className="w-9 h-9 bg-foreground/5 rounded-full relative overflow-hidden">
                        <Shimmer />
                    </div>
				</div>
			</header>

			{/* Main Content Skeleton */}
			<main className="dashboard-main no-scrollbar bg-background">
				<div className="max-w-7xl mx-auto">
					{/* Suggested Section */}
					<div className="mb-10">
						<div className="h-3 w-20 bg-foreground/5 rounded mb-4 relative overflow-hidden uppercase tracking-wider">
							<Shimmer />
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
							{[1, 2, 3, 4].map((i) => (
								<div key={i} className="bg-background border border-foreground/10 rounded-xl p-4 space-y-3">
									<div className="h-28 bg-foreground/5 rounded-lg relative overflow-hidden">
										<Shimmer />
									</div>
									<div className="flex items-center gap-2">
										<div className="w-4 h-4 bg-foreground/5 rounded-full relative overflow-hidden">
											<Shimmer />
										</div>
										<div className="h-4 w-24 bg-foreground/5 rounded relative overflow-hidden">
											<Shimmer />
										</div>
									</div>
								</div>
							))}
						</div>
					</div>

					{/* Header */}
					<div className="flex justify-between items-center mb-6">
						<div className="h-8 w-48 bg-foreground/5 rounded relative overflow-hidden">
							<Shimmer />
						</div>
						<div className="w-20 h-9 bg-foreground/5 rounded-lg relative overflow-hidden">
							<Shimmer />
						</div>
					</div>

					{/* Project Grid */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{[1, 2, 3, 4, 5, 6].map((i) => (
							<div key={i} className="bg-foreground/5 border border-foreground/10 rounded-2xl p-6 space-y-4">
								<div className="h-44 bg-foreground/10 rounded-xl relative overflow-hidden">
									<Shimmer />
								</div>
								<div className="flex justify-between items-center">
									<div className="h-6 w-40 bg-foreground/10 rounded-lg relative overflow-hidden">
										<Shimmer />
									</div>
									<div className="h-6 w-6 bg-foreground/10 rounded-md relative overflow-hidden">
										<Shimmer />
									</div>
								</div>
								<div className="h-3 w-24 bg-foreground/5 rounded relative overflow-hidden">
									<Shimmer />
								</div>
								<div className="h-[46px] w-full bg-foreground/10 rounded-xl relative overflow-hidden mt-6">
									<Shimmer />
								</div>
							</div>
						))}
					</div>
				</div>
			</main>
		</div>
	)
}

export default DashboardSkeleton
