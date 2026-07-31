/**
 * Browser shim for the design-system bundle: components reference Next-provided
 * process.env.* at module scope, which doesn't exist in a plain browser IIFE.
 * Imported FIRST from design-system.ts so it evaluates before any component module.
 * No-op inside Next.js (process exists there).
 */
const g = globalThis as Record<string, unknown>
if (typeof g.process === 'undefined') {
    g.process = { env: {} }
}

export {}
