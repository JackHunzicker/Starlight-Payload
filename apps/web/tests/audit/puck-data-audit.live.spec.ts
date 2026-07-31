import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { migrateLegacyPuckData } from '@/lib/migrateLegacyPuckData'
import { puckConfig } from '@/components/puck/puckConfig'
import { buildContract, auditPuckData, formatIssues, type ComponentContract, type PuckAuditIssue } from '@/lib/puckAudit'
import type { Data } from '@puckeditor/core'

import { describe, it, beforeAll, expect } from 'vitest'

/**
 * READ-ONLY audit of THIS installation's stored Puck data (published pages,
 * latest drafts, version history) against the merged editor config. Run with:
 *
 *   pnpm run audit:puck-data
 *
 * This is intentionally not part of the normal CI test suite: it inspects the
 * shared development database, and an empty database passes trivially. The
 * deterministic contract/migration tests live in tests/int/.
 */

let payload: Payload
let contract: ComponentContract

describe('Live Puck data audit', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
    contract = buildContract(puckConfig as never)
  })

  it('published pages conform to the current component schema after runtime migration', async () => {
    const pages = await payload.find({ collection: 'pages', draft: false, limit: 1000, pagination: false })
    console.info(`[puck-audit] published pages inspected: ${pages.docs.length}`)
    const issues: PuckAuditIssue[] = []
    for (const page of pages.docs) {
      const data = page.puckData as Data | null | undefined
      if (!data) continue
      issues.push(...auditPuckData(migrateLegacyPuckData(data), `published:${page.slug}`, contract))
    }
    expect(issues, formatIssues(issues)).toEqual([])
  })

  it('published pages are stored already-migrated (no legacy shapes at rest)', async () => {
    const pages = await payload.find({ collection: 'pages', draft: false, limit: 1000, pagination: false })
    const stale = pages.docs
      .filter(page => {
        const data = page.puckData as Data | null | undefined
        return data && migrateLegacyPuckData(data) !== data
      })
      .map(page => page.slug)
    expect(stale, `pages stored with un-migrated legacy Puck data (run migrate:puck-slots): ${stale.join(', ')}`).toEqual([])
  })

  it('latest drafts conform and are stored already-migrated (the editor loads draft data raw)', async () => {
    const drafts = await payload.find({ collection: 'pages', draft: true, limit: 1000, pagination: false })
    console.info(`[puck-audit] draft documents inspected: ${drafts.docs.length}`)
    const issues: PuckAuditIssue[] = []
    const stale: string[] = []
    for (const page of drafts.docs) {
      const data = page.puckData as Data | null | undefined
      if (!data) continue
      if (migrateLegacyPuckData(data) !== data) stale.push(page.slug as string)
      issues.push(...auditPuckData(migrateLegacyPuckData(data), `draft:${page.slug}`, contract))
    }
    expect(issues, formatIssues(issues)).toEqual([])
    expect(stale, `drafts stored with un-migrated legacy Puck data (run migrate:puck-slots): ${stale.join(', ')}`).toEqual([])
  })

  it('reports version-history conformance (informational: restore path migrates at runtime)', async () => {
    const versions = await payload.findVersions({ collection: 'pages', limit: 500 })
    const issues: PuckAuditIssue[] = []
    let legacyAtRest = 0
    for (const version of versions.docs) {
      const data = (version.version as { puckData?: Data | null }).puckData
      if (!data) continue
      if (migrateLegacyPuckData(data) !== data) legacyAtRest += 1
      issues.push(...auditPuckData(migrateLegacyPuckData(data), `version:${version.id}`, contract))
    }
    if (legacyAtRest > 0) {
      console.warn(`[puck-audit] ${legacyAtRest}/${versions.docs.length} stored versions carry legacy shapes (migrated on restore)`)
    }
    expect(issues, formatIssues(issues)).toEqual([])
  })
})
