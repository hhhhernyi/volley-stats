'use client'

import { useEffect } from 'react'
import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill'

/**
 * Windows has no color font for country-flag emoji, so 🇮🇹 falls back to the
 * letters "IT". This injects a flag-only subset of Twemoji (self-hosted,
 * ~78 KB, unicode-range limited to flag codepoints) on platforms that need
 * it. The font is first in the body font stack (see globals.css).
 */
export function FlagEmojiPolyfill() {
  useEffect(() => {
    polyfillCountryFlagEmojis('Twemoji Country Flags', '/TwemojiCountryFlags.woff2')
  }, [])

  return null
}
