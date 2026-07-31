import type { Data } from '@puckeditor/core'

/**
 * Schema audit for stored Puck data against the merged editor config.
 *
 * The contract is derived from the same config object the editor GUI uses, so
 * "conforms" means: every component type exists, every prop is a declared field
 * (or a Puck-internal prop), nested content lives only inside declared slot
 * fields, and scalar values match their declared field kind.
 */

export type PuckAuditIssue = {
  doc: string
  path: string
  kind:
    | 'unknown-component'
    | 'unknown-prop'
    | 'legacy-zones'
    | 'missing-props'
    | 'invalid-value'
    | 'misplaced-content'
  detail: string
}

type FieldSpec = {
  type?: string
  options?: { value: unknown }[]
}

export type ComponentContract = Map<string, Record<string, FieldSpec>>

type PuckItem = { type: string; props: Record<string, unknown> }

// Props Puck itself owns on every component instance.
const PUCK_INTERNAL_PROPS = new Set(['id', 'editMode'])

export function isPuckItem(value: unknown): value is PuckItem {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as PuckItem).type === 'string' &&
    typeof (value as PuckItem).props === 'object'
  )
}

/** Derive the component contract from a Puck config object. */
export function buildContract(config: { components: Record<string, unknown> }): ComponentContract {
  return new Map(
    Object.entries(config.components).map(([name, component]) => [
      name,
      ((component as { fields?: Record<string, FieldSpec> }).fields ?? {}) as Record<string, FieldSpec>,
    ]),
  )
}

function checkValue(field: FieldSpec, value: unknown): boolean {
  if (value === null || value === undefined) return true
  switch (field.type) {
    case 'select':
    case 'radio':
      return !field.options || field.options.some(option => option.value === value)
    case 'number':
      return typeof value === 'number'
    case 'text':
    case 'textarea':
      return typeof value === 'string'
    default:
      // object/array/custom/external fields have library- or project-defined
      // shapes; validating those belongs to per-field contract tests.
      return true
  }
}

function auditItem(
  item: PuckItem,
  doc: string,
  path: string,
  contract: ComponentContract,
  issues: PuckAuditIssue[],
): void {
  const fields = contract.get(item.type)
  if (!fields) {
    issues.push({ doc, path, kind: 'unknown-component', detail: item.type })
    return
  }
  if (!item.props || typeof item.props !== 'object') {
    issues.push({ doc, path, kind: 'missing-props', detail: item.type })
    return
  }

  for (const [key, value] of Object.entries(item.props)) {
    if (PUCK_INTERNAL_PROPS.has(key)) continue
    const field = fields[key]
    if (!field) {
      issues.push({ doc, path, kind: 'unknown-prop', detail: `${item.type}.${key}` })
      continue
    }

    if (field.type === 'slot') {
      if (value === null || value === undefined) continue
      if (!Array.isArray(value)) {
        issues.push({ doc, path, kind: 'invalid-value', detail: `${item.type}.${key}: slot value is not an array` })
        continue
      }
      value.forEach((child, index) => {
        if (isPuckItem(child)) {
          auditItem(child, doc, `${path}/${item.type}#${key}[${index}]`, contract, issues)
        } else {
          issues.push({
            doc,
            path,
            kind: 'invalid-value',
            detail: `${item.type}.${key}[${index}]: slot entry is not a component`,
          })
        }
      })
      continue
    }

    // Component-shaped data outside a declared slot cannot be edited or
    // rendered as content — it is orphaned structure.
    if (Array.isArray(value) && value.some(isPuckItem)) {
      issues.push({ doc, path, kind: 'misplaced-content', detail: `${item.type}.${key}` })
      continue
    }

    if (!checkValue(field, value)) {
      issues.push({
        doc,
        path,
        kind: 'invalid-value',
        detail: `${item.type}.${key}: ${JSON.stringify(value)} does not match ${field.type} field`,
      })
    }
  }
}

/** Audit one stored Puck document. `doc` labels issues (e.g. "published:home"). */
export function auditPuckData(
  data: Data | null | undefined,
  doc: string,
  contract: ComponentContract,
): PuckAuditIssue[] {
  const issues: PuckAuditIssue[] = []
  if (!data || typeof data !== 'object') return issues
  if (data.zones && Object.keys(data.zones).length > 0) {
    issues.push({ doc, path: '/', kind: 'legacy-zones', detail: Object.keys(data.zones).join(', ') })
  }
  for (const [index, item] of (data.content ?? []).entries()) {
    if (isPuckItem(item)) auditItem(item, doc, `/content[${index}]`, contract, issues)
  }
  return issues
}

export function formatIssues(issues: PuckAuditIssue[]): string {
  return issues.map(issue => `${issue.doc} ${issue.path} ${issue.kind}: ${issue.detail}`).join('\n')
}
