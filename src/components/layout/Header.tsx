'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from './ThemeProvider'

export function Header() {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
    >
      <div className="mx-auto max-w-[1060px] px-4 sm:px-5 py-3.5 flex items-center gap-3 sm:gap-6">
        {/* Brand */}
        <div
          className="flex items-baseline gap-2.5 font-bold tracking-tight text-[19px]"
          style={{ color: 'var(--text)' }}
        >
          <span>VolleyStat</span>
          <span style={{ color: 'var(--accent)' }}>.</span>
        </div>

        {/* Nav tabs */}
        <nav className="flex gap-1 ml-auto">
          {[
            { href: '/compare',   label: 'Compare'   },
            { href: '/all-stats', label: 'All stats' },
          ].map(({ href, label }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className="text-sm font-medium px-2.5 sm:px-3.5 py-2 rounded-[var(--radius-sm)] transition-colors duration-150 whitespace-nowrap"
                style={{
                  background: active ? 'var(--surface-2)' : 'transparent',
                  color:      active ? 'var(--text)'      : 'var(--text-dim)',
                }}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          aria-label="Toggle theme"
          title="Toggle theme"
          className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] border text-base transition-colors duration-150 cursor-pointer"
          style={{
            background:   'var(--surface)',
            borderColor:  'var(--border)',
            color:        'var(--text-dim)',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-2)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-dim)'
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
          }}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>
    </header>
  )
}
