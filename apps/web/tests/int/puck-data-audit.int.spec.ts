import { describe, it, beforeAll, expect } from 'vitest'
import { puckConfig } from '@/components/puck/puckConfig'
import { migrateLegacyPuckData } from '@/lib/migrateLegacyPuckData'
import { buildContract, auditPuckData, type ComponentContract } from '@/lib/puckAudit'

/**
 * Deterministic contract tests for the Puck schema auditor. These run against
 * fixtures only — no database — so they hold on a clean install and in CI.
 * The live installation is audited separately: `pnpm run audit:puck-data`.
 */

let contract: ComponentContract

describe('Puck schema contract', () => {
  beforeAll(() => {
    contract = buildContract(puckConfig as never)
  })

  it('the merged editor config declares a non-trivial field contract for every component', () => {
    expect(contract.size).toBeGreaterThanOrEqual(22)
    const fieldless = [...contract.entries()].filter(([, fields]) => Object.keys(fields).length === 0).map(([name]) => name)
    expect(fieldless, `components without any declared fields: ${fieldless.join(', ')}`).toEqual([])
  })

  it('accepts a conforming document, recursing declared slots', () => {
    const data = {
      root: { props: { title: 'Fixture' } },
      content: [
        {
          type: 'Section',
          props: {
            id: 's1',
            semanticElement: 'section',
            content: [
              { type: 'Heading', props: { id: 'h1', text: 'Hello', level: 'h2', alignment: 'center' } },
              { type: 'Text', props: { id: 't1', content: 'World', alignment: 'center' } },
            ],
          },
        },
      ],
    }
    expect(auditPuckData(data as never, 'fixture', contract)).toEqual([])
  })

  it('flags unknown components, unknown props, and legacy zones', () => {
    const data = {
      root: { props: {} },
      content: [
        { type: 'CTABlock', props: { id: 'cta', title: 'Legacy' } },
        { type: 'Heading', props: { id: 'h1', text: 'Hi', size: 'xxxl' } },
      ],
      zones: { 'x:content': [] },
    }
    const issues = auditPuckData(data as never, 'fixture', contract)
    const kinds = issues.map(issue => `${issue.kind}:${issue.detail}`)
    expect(kinds).toContain('unknown-component:CTABlock')
    expect(kinds).toContain('unknown-prop:Heading.size')
    expect(issues.some(issue => issue.kind === 'legacy-zones')).toBe(true)
  })

  it('flags invalid field values and misplaced component content', () => {
    const data = {
      root: { props: {} },
      content: [
        // numeric level is not among the select options — the exact shape that
        // crashed the client render with React #130 on 2026-07-23
        { type: 'Heading', props: { id: 'h1', text: 'Hi', level: 2 } },
        // component data under a declared non-slot field is orphaned structure
        { type: 'Card', props: { id: 'c1', heading: 'X', text: [{ type: 'Text', props: { id: 'n1' } }] } },
      ],
    }
    const issues = auditPuckData(data as never, 'fixture', contract)
    expect(issues.some(issue => issue.kind === 'invalid-value' && issue.detail.startsWith('Heading.level'))).toBe(true)
    expect(issues.some(issue => issue.kind === 'misplaced-content')).toBe(true)
  })

  it('catches per-component field-shape traps (Button openInNewTab is yes/no, Card is boolean)', () => {
    const wrong = {
      root: { props: {} },
      content: [{ type: 'Button', props: { id: 'b1', text: 'Go', link: '/x', openInNewTab: true } }],
    }
    const issues = auditPuckData(wrong as never, 'fixture', contract)
    expect(
      issues.some(i => i.kind === 'invalid-value' && i.detail.startsWith('Button.openInNewTab')),
      'auditor must reject a boolean for Button.openInNewTab — Button silently ignores it',
    ).toBe(true)

    const right = {
      root: { props: {} },
      content: [
        { type: 'Button', props: { id: 'b1', text: 'Go', link: '/x', openInNewTab: 'yes' } },
        { type: 'Card', props: { id: 'c1', heading: 'H', text: 'T', link: '/y', openInNewTab: true } },
      ],
    }
    expect(auditPuckData(right as never, 'fixture', contract)).toEqual([])
  })

  it('a fully legacy document conforms after migrateLegacyPuckData', () => {
    const legacy = {
      root: { props: {} },
      content: [
        { type: 'SharkeyFeedBlock', props: { id: 'feed', apiUrl: 'http://localhost:7777', limit: 20, refreshInterval: 0 } },
        { type: 'CTABlock', props: { id: 'cta', title: 'Join', description: 'Do it.', buttonText: 'Go', buttonLink: '/x' } },
        { type: 'ArticlesSkeletonBlock', props: { id: 'a', title: 'Articles', description: 'Reads.' } },
        { type: 'Section', props: { id: 's', background: { type: 'solid', color: { r: 13, g: 17, b: 23, a: 1 } }, element: 'section', content: [] } },
        { type: 'Heading', props: { id: 'h', text: 'Welcome', level: 1, size: 'xxxl', align: 'center' } },
      ],
      zones: { 's:content': [{ type: 'Text', props: { id: 't', text: 'Legacy', align: 'left', color: 'muted-foreground' } }] },
    }
    const migrated = migrateLegacyPuckData(legacy as never)
    expect(auditPuckData(migrated, 'fixture', contract)).toEqual([])
  })
})
