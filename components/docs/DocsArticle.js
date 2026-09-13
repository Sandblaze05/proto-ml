'use client'

import Link from 'next/link'
import { useState } from 'react'

export function DocsBreadcrumb({ current }) {
  return <div className="docs-breadcrumb"><Link href="/docs">Docs</Link><span>/</span><span>{current}</span></div>
}

export function DocsArticle({ children, title, description, eyebrow, current, toc = [] }) {
  return (
    <article className="docs-article">
      <DocsBreadcrumb current={current || title} />
      <div className="docs-article-eyebrow">{eyebrow || 'proto-ML documentation'}</div>
      <h1>{title}</h1>
      {description && <p className="docs-article-lede">{description}</p>}
      <div className="docs-rule" />
      <div className="docs-article-body">{children}</div>
      <div className="docs-article-footer"><span>Was this page helpful?</span><button>Yes</button><button>Not really</button></div>
    </article>
  )
}

export function DocsAside({ toc }) {
  return <aside className="docs-right-rail"><p>On this page</p>{toc.map((item) => <a href={`#${item.id}`} key={item.id}>{item.label}</a>)}<div className="docs-right-rule" /><Link href="/" className="docs-edit-link">Suggest an edit ↗</Link></aside>
}

export function CodeBlock({ children, label = 'example' }) {
  const [copied, setCopied] = useState(false)
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(String(children))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }
  return <div className="docs-code"><div className="docs-code-bar"><span><i /><i /><i /></span><small>{label}</small><button onClick={copyCode} type="button">{copied ? 'Copied' : 'Copy'}</button></div><pre><code>{children}</code></pre></div>
}

export function Note({ children, tone = 'cyan' }) { return <div className={`docs-note docs-note-${tone}`}><span>i</span><div>{children}</div></div> }

export function DocsCardGrid({ cards }) { return <div className="docs-card-grid">{cards.map((card) => <Link href={card.href} className="docs-card" key={card.title}><span className="docs-card-icon">{card.icon}</span><strong>{card.title}</strong><p>{card.description}</p><span className="docs-card-link">Read guide →</span></Link>)}</div> }
