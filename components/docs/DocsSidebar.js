'use client'

import Link from 'next/link'
import { ChevronDown, Database, GitBranch, Layers3, Play, Sparkles } from 'lucide-react'

const groups = [
  {
    label: 'Start here',
    items: [
      ['Overview', '/docs'],
      ['Quickstart', '/docs/getting-started'],
      ['Project structure', '/docs/project-structure'],
    ],
  },
  {
    label: 'Build pipelines',
    items: [
      ['Canvas basics', '/docs/canvas-basics'],
      ['Datasets', '/docs/nodes-and-data'],
      ['Transform nodes', '/docs/nodes-and-data#transform-nodes'],
      ['Run and inspect', '/docs/run-and-inspect'],
    ],
  },
  {
    label: 'Ship with confidence',
    items: [
      ['Version control', '/docs/version-control'],
      ['Exporting pipelines', '/docs/exporting'],
      ['Sharing projects', '/docs/sharing'],
    ],
  },
]

export default function DocsSidebar({ currentPath }) {
  return (
    <aside className="docs-sidebar">
      <nav className="docs-sidebar-nav" aria-label="Documentation">
        {groups.map((group) => (
          <div className="docs-sidebar-group" key={group.label}>
            <p>{group.label}</p>
            {group.items.map(([label, href]) => {
              const active = currentPath === href || (href === '/docs' && currentPath === '/docs')
              return <Link key={href} href={href} className={active ? 'is-active' : ''}>{label}</Link>
            })}
          </div>
        ))}
      </nav>

      <div className="docs-sidebar-bottom">
        <div className="docs-sidebar-mini-card"><Database size={16} /><span>Build with real data</span><small>CSV, JSON, API & SQL sources</small></div>
        <Link href="/dashboard" className="docs-sidebar-workspace"><Play size={14} /> Go to workspace <ArrowIcon /></Link>
      </div>
    </aside>
  )
}

function BookIcon() { return <Layers3 size={17} /> }
function ArrowIcon() { return <GitBranch size={13} /> }
