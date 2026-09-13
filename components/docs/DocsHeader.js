'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight, BookOpen, Command, Search } from 'lucide-react'

export default function DocsHeader({ onSearch }) {
  return (
    <header className="docs-header">
      <Link href="/" className="docs-brand" aria-label="proto-ML home">
        <Image src="/logo.png" alt="" width={31} height={31} className="docs-brand-logo" priority />
        <span>proto-ML</span>
      </Link>

      <nav className="docs-top-nav" aria-label="Primary">
        <Link href="/dashboard">Workspace</Link>
        <Link href="/docs" className="is-active">Docs</Link>
        <Link href="/about">About</Link>
      </nav>

      <div className="docs-header-actions">
        <button className="docs-search-trigger" onClick={onSearch} type="button">
          <Search size={15} />
          <span>Search documentation...</span>
          <kbd><Command size={11} />K</kbd>
        </button>
        <Link href="/" className="docs-header-link">Feedback</Link>
        <Link href="/dashboard" className="docs-learn-button">Open app <ArrowUpRight size={14} /></Link>
      </div>
    </header>
  )
}
