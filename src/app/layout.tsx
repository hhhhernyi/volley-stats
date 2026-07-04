import type { Metadata } from 'next'
import { Providers } from './providers'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { Header } from '@/components/layout/Header'
import './globals.css'

export const metadata: Metadata = {
  title: 'VolleyStat — Player comparison dashboard',
  description: 'Compare volleyball players across seasons and positions',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <Providers>
            <Header />
            <main className="mx-auto max-w-[1060px] px-5 pb-20">
              {children}
            </main>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
