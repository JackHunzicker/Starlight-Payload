import { describe, it, expect, beforeAll } from 'vitest'
import { puckConfig } from '@/components/puck/puckConfig'
import { buildContract, auditPuckData, type ComponentContract } from '@/lib/puckAudit'
import { validatePuckData, PuckValidationError } from '@/app/api/puck/ai/core/validate-puck-data'

/**
 * The AI write path must not be able to produce data the stored-data auditor rejects.
 *
 * Two validators exist in this codebase and they used to disagree: `puckAudit.ts`
 * rejects a select value that is not a listed option, while the AI sanitizer merely
 * pushed a warning and wrote the bad value through. The result was AI-authored pages
 * that `pnpm run audit:puck-data` would later flag.
 *
 * This test pins the invariant rather than the implementation: whatever the AI
 * proposes, the sanitized output audits clean.
 */

let contract: ComponentContract
/** The sanitizer consumes the field schema the plugin-ai client posts, keyed by component. */
let aiConfig: { components: Record<string, { fields: Record<string, unknown> }> }

beforeAll(() => {
  contract = buildContract(puckConfig as never)
  aiConfig = {
    components: Object.fromEntries(
      [...contract.entries()].map(([name, fields]) => [name, { fields }]),
    ),
  }
})

const auditClean = (data: unknown) => auditPuckData(data as never, 'ai-proposal', contract)

describe('AI proposal sanitizer conforms to the stored-data auditor', () => {
  it('drops a select value that is not a listed option', () => {
    const { data, warnings } = validatePuckData(
      {
        root: { props: { title: 'T' } },
        content: [
          { type: 'Heading', props: { id: 'h1', text: 'Hi', level: 'h11', alignment: 'center' } },
        ],
      },
      aiConfig,
    )

    const heading = (data.content as Array<Record<string, never>>)[0] as unknown as {
      props: Record<string, unknown>
    }
    expect(heading.props.level, 'invalid select value must not survive').toBeUndefined()
    expect(heading.props.text).toBe('Hi')
    expect(warnings.some((w) => w.includes('not a listed option'))).toBe(true)
    expect(auditClean(data)).toEqual([])
  })

  const gridProps = (data: Record<string, unknown>) =>
    (data.content as unknown as Array<{ props: Record<string, unknown> }>)[0].props

  it('drops a non-numeric value for a number field', () => {
    const { data } = validatePuckData(
      {
        root: { props: { title: 'T' } },
        content: [{ type: 'Grid', props: { id: 'g1', numColumns: 'lots' } }],
      },
      aiConfig,
    )
    expect(gridProps(data).numColumns).toBeUndefined()
    expect(auditClean(data)).toEqual([])
  })

  it('coerces a numeric string rather than discarding a usable value', () => {
    const { data } = validatePuckData(
      {
        root: { props: { title: 'T' } },
        content: [{ type: 'Grid', props: { id: 'g1', numColumns: '3' } }],
      },
      aiConfig,
    )
    expect(gridProps(data).numColumns).toBe(3)
    expect(auditClean(data)).toEqual([])
  })

  it('clamps a number to the bounds the field declares', () => {
    // Grid.numColumns declares min 1, max 12. An unclamped 400 would render a
    // grid no viewport can show.
    const over = validatePuckData(
      {
        root: { props: { title: 'T' } },
        content: [{ type: 'Grid', props: { id: 'g1', numColumns: 400 } }],
      },
      aiConfig,
    )
    expect(gridProps(over.data).numColumns).toBe(12)

    const under = validatePuckData(
      {
        root: { props: { title: 'T' } },
        content: [{ type: 'Grid', props: { id: 'g1', numColumns: -5 } }],
      },
      aiConfig,
    )
    expect(gridProps(under.data).numColumns).toBe(1)
    expect(auditClean(under.data)).toEqual([])
  })

  it('still rejects unknown component types outright', () => {
    expect(() =>
      validatePuckData(
        { root: { props: {} }, content: [{ type: 'NotARealBlock', props: { id: 'x' } }] },
        aiConfig,
      ),
    ).toThrow(PuckValidationError)
  })

  it('audits clean across an adversarial proposal touching every component', () => {
    // One instance of every component the editor knows about, each given a
    // deliberately invalid value for every select and number field it declares.
    const content = [...contract.entries()].map(([type, fields], index) => {
      const props: Record<string, unknown> = { id: `${type}-${index}` }
      for (const [fieldName, spec] of Object.entries(fields)) {
        const field = spec as { type?: string }
        if (field.type === 'select' || field.type === 'radio') {
          props[fieldName] = '__definitely_not_an_option__'
        } else if (field.type === 'number') {
          props[fieldName] = 'not-a-number'
        }
      }
      return { type, props }
    })

    const { data } = validatePuckData({ root: { props: { title: 'Adversarial' } }, content }, aiConfig)

    const issues = auditClean(data)
    expect(
      issues,
      `sanitized AI output must audit clean, got:\n${issues.map((i) => JSON.stringify(i)).join('\n')}`,
    ).toEqual([])
  })

  it('assigns every component a unique id', () => {
    const { data } = validatePuckData(
      {
        root: { props: { title: 'T' } },
        content: [
          { type: 'Heading', props: { id: 'dupe', text: 'A' } },
          { type: 'Heading', props: { id: 'dupe', text: 'B' } },
          { type: 'Heading', props: { text: 'C' } },
        ],
      },
      aiConfig,
    )
    const ids = (data.content as unknown as Array<{ props: { id: string } }>).map((c) => c.props.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids.every(Boolean)).toBe(true)
  })
})
