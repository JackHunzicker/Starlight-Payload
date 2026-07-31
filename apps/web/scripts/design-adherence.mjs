#!/usr/bin/env node
/**
 * Design-system adherence gate (see .design-adherence/README.md).
 *
 * Derived from the design system's `_adherence.oxlintrc.json`. oxlint does not
 * implement `no-restricted-syntax`, so the two enforceable rules run here:
 *
 *  1. Fonts: any font-family literal must resolve to Inter, JetBrains Mono or
 *     Spectral (the blueprint's ruled set; Spectral is DEMO-only per turn 5).
 *  2. Imports: design-system components come from the package entry, never
 *     from component internals.
 *
 * Exits 1 on violations so it can gate CI.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOTS = ['src/components/puck', 'src/components/layout', 'src/components/brand']
const ALLOWED_FONTS = /^['"]?(Inter|JetBrains Mono|Spectral|var\(--font-(sans|mono|serif)\))/
const FONT_DECL = /font-?[Ff]amily['"]?\s*[:=]\s*['"`]([^'"`]+)['"`]/g
const BAD_IMPORT = /from\s+['"](?:[^'"]*components\/general\/(?:CourseCatalogBlock|CourseDetailBlock|ExternalFeedBlock|ProductCatalogBlock|ProductDetailBlock|SiteFooter|SiteHeader)\/)[^'"]*['"]/g

function* walk(dir) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) yield* walk(full)
        else if (/\.(tsx?|jsx?|css)$/.test(entry)) yield full
    }
}

let violations = 0
for (const root of ROOTS) {
    let files
    try {
        files = [...walk(root)]
    } catch {
        continue
    }
    for (const file of files) {
        const text = readFileSync(file, 'utf8')
        const rel = relative(process.cwd(), file)
        for (const match of text.matchAll(FONT_DECL)) {
            const value = match[1].trim()
            if (!ALLOWED_FONTS.test(value)) {
                violations++
                console.error(`${rel}: font not in the design system: "${value}" (allowed: Inter, JetBrains Mono, Spectral)`)
            }
        }
        for (const match of text.matchAll(BAD_IMPORT)) {
            violations++
            console.error(`${rel}: import design-system components from the package entry, not internals: ${match[0]}`)
        }
    }
}

if (violations > 0) {
    console.error(`\ndesign-adherence: ${violations} violation(s).`)
    process.exit(1)
}
console.log('design-adherence: clean.')
