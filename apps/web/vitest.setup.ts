// Any setup scripts you might need go here

// Load .env files
import 'dotenv/config'

import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

/**
 * Unmount rendered trees between tests.
 *
 * Testing Library registers this automatically only when the runner exposes
 * globals, and this project runs vitest without `globals: true`. So every
 * `render()` stayed mounted for the life of the test file, and React's scheduler
 * could fire queued work after jsdom had been torn down — surfacing as an
 * intermittent "ReferenceError: window is not defined" that failed the suite
 * while every individual test passed. Unmounting drains that work in time.
 */
afterEach(() => {
  cleanup()
})

// jsdom lacks ResizeObserver; @puckeditor/core (via @dnd-kit/dom) requires it at
// module-evaluation time when the Delmare richtext field is in the import graph.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
