import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// --bg2 and --bg3 are both used app-wide as "the card surface" (grep:
// ~53 components reference --bg2, ~97 reference --bg3, for the same visual
// element). In the dark theme they differ by ~7/channel — imperceptible. In
// the light theme --bg2 was #FFFFFF and --bg3 was #F7F7FA, which reads as
// "white card" vs "grey card" side by side. This test locks the light-theme
// card surface to one value so the two tokens can't drift apart again.

const css = readFileSync(resolve(__dirname, '../app/globals.css'), 'utf8')

function tokensIn(selector: string): Record<string, string> {
  const start = css.indexOf(selector)
  if (start === -1) throw new Error(`selector not found: ${selector}`)
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  const body = css.slice(open + 1, close)
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[m[1].trim()] = m[2].trim()
  }
  return out
}

describe('globals.css surface tokens', () => {
  const dark = tokensIn(':root {')
  const light = tokensIn('[data-theme="light"] {')

  it('light theme: --bg2 and --bg3 (card surface) resolve to the same colour', () => {
    expect(light['--bg3']).toBe(light['--bg2'])
  })

  it('dark theme surface tokens are untouched by the light-theme fix', () => {
    expect(dark['--bg']).toBe('#0D0D11')
    expect(dark['--bg2']).toBe('#131318')
    expect(dark['--bg3']).toBe('#1A1A24')
    expect(dark['--bg4']).toBe('#21212E')
    expect(dark['--bg5']).toBe('#282836')
  })

  it('light theme keeps a distinct page background and inset tiers below the card', () => {
    // page bg and the inset tokens must stay different from the card so
    // cards still pop and nested/inset surfaces still read as nested.
    expect(light['--bg']).not.toBe(light['--bg3'])
    expect(light['--bg4']).not.toBe(light['--bg3'])
    expect(light['--bg5']).not.toBe(light['--bg3'])
  })
})
