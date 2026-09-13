'use client'

import Link from 'next/link'
import { FileText } from 'lucide-react'
import { useEffect, useState } from 'react'
import DocsHeader from './DocsHeader'
import DocsSidebar from './DocsSidebar'

const searchItems = [
  { title: 'Overview', href: '/docs', section: 'Start here', description: 'What proto-ML is and how visual pipelines fit together.', keywords: 'intro workflow graph' },
  { title: 'Quickstart', href: '/docs/getting-started', section: 'Start here', description: 'Build and run your first text-processing pipeline.', keywords: 'first pipeline getting started text' },
  { title: 'Project structure', href: '/docs/project-structure', section: 'Start here', description: 'Understand projects, nodes, connections, and saved versions.', keywords: 'project graph versions organization' },
  { title: 'Canvas basics', href: '/docs/canvas-basics', section: 'Build pipelines', description: 'Compose nodes, connect ports, and keep a graph readable.', keywords: 'canvas nodes edges connections layout' },
  { title: 'Nodes and data', href: '/docs/nodes-and-data', section: 'Build pipelines', description: 'Bring CSV, JSON, text, image, API, and database data into a graph.', keywords: 'datasets transforms csv json api database' },
  { title: 'Run and inspect', href: '/docs/run-and-inspect', section: 'Build pipelines', description: 'Preview a graph, inspect outputs, and diagnose failures.', keywords: 'run preview debug inspect execution' },
  { title: 'Version control', href: '/docs/version-control', section: 'Ship with confidence', description: 'Create checkpoints and compare meaningful pipeline changes.', keywords: 'versions history compare restore' },
  { title: 'Exporting pipelines', href: '/docs/exporting', section: 'Ship with confidence', description: 'Take a pipeline from the canvas into a portable Python project.', keywords: 'export python code deployment' },
  { title: 'Sharing projects', href: '/docs/sharing', section: 'Ship with confidence', description: 'Share a reproducible graph with teammates and collaborators.', keywords: 'share collaborate permissions handoff' },
]

export default function DocsLayout({ children, currentPath }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(true) }
      if (event.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const normalizedQuery = query.trim().toLowerCase()
  const results = searchItems.filter((item) => !normalizedQuery || `${item.title} ${item.section} ${item.description} ${item.keywords}`.toLowerCase().includes(normalizedQuery))
  const closeSearch = () => { setSearchOpen(false); setQuery('') }
return <div className="docs-shell"><DocsHeader onSearch={() => setSearchOpen(true)} /><div className="docs-layout"><DocsSidebar currentPath={currentPath} /><main className="docs-main">{children}</main></div>{searchOpen && <div className="docs-search-overlay" role="dialog" aria-modal="true" aria-label="Search documentation" onClick={closeSearch}><div className="docs-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="docs-search-input-wrap"><input value={query} onChange={(event) => setQuery(event.target.value)} autoFocus placeholder="What are you searching for?" aria-label="Search documentation" /><kbd>Esc</kbd></div>
    <div className="docs-search-results" aria-live="polite">
      {results.length > 0 ? results.map((item, index) => <Link href={item.href} className={`docs-search-result${index === 0 && !normalizedQuery ? ' is-highlighted' : ''}`} key={item.href} onClick={closeSearch}><FileText size={19} className="docs-search-result-icon" /><strong>{item.title}</strong></Link>) : <div className="docs-search-empty">No pages found for <strong>“{query}”</strong>.</div>}
    </div>
  </div></div>}</div>
}
