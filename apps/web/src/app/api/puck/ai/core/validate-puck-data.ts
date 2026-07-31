/**
 * Recursive validation of AI-proposed Puck Data against the Puck config.
 *
 * The proposal only ever reaches the editor canvas (never Payload, never
 * publish), so validation is about robustness: reject unknown component
 * types outright, strip unknown props, ensure ids exist and are unique, and
 * recurse through slot / array / object fields so nested garbage cannot
 * corrupt editor state.
 *
 * The field schemas come from the config the plugin-ai client posts with
 * every request. That request is Payload-authenticated (admin editors only).
 * Hardening TODO tracked in the routing knowledge doc: generate the contract
 * server-side at build time instead of trusting the posted copy.
 */

type AnyRecord = Record<string, any>

export class PuckValidationError extends Error {
    constructor(public problems: string[]) {
        super(`Proposed page data rejected: ${problems.join('; ')}`)
        this.name = 'PuckValidationError'
    }
}

const newId = (type: string) =>
    `${type}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`

/**
 * Returned by `validateFieldValue` when a value cannot be made conformant.
 *
 * Dropping the prop leaves the component to fall back to its declared default,
 * which is always valid. Previously an out-of-contract value was merely warned
 * about and then written through to the editor, so `pnpm run audit:puck-data`
 * would later flag stored data that the AI path itself had produced. The
 * invariant now is: anything this function returns satisfies `auditPuckData`.
 */
const DROP = Symbol('drop-invalid-prop')

export function validatePuckData(
    proposed: AnyRecord,
    config: AnyRecord,
): { data: AnyRecord; warnings: string[] } {
    const warnings: string[] = []
    const problems: string[] = []
    const seenIds = new Set<string>()
    const components: AnyRecord = config?.components ?? {}

    if (!proposed || typeof proposed !== 'object') {
        throw new PuckValidationError(['proposal is not an object'])
    }
    if (!Array.isArray(proposed.content)) {
        throw new PuckValidationError(['proposal has no content array'])
    }

    const validateFieldValue = (value: any, field: AnyRecord, path: string): any => {
        if (value === undefined || value === null || !field || typeof field !== 'object') return value
        switch (field.type) {
            case 'slot': {
                if (!Array.isArray(value)) {
                    warnings.push(`${path}: slot value was not an array, replaced with []`)
                    return []
                }
                return value.map((item, i) => validateComponent(item, `${path}[${i}]`)).filter(Boolean)
            }
            case 'array': {
                if (!Array.isArray(value)) {
                    warnings.push(`${path}: array field value was not an array, replaced with []`)
                    return []
                }
                return value.map((item, i) => {
                    if (!item || typeof item !== 'object') return item
                    return validateProps(item, field.arrayFields ?? {}, `${path}[${i}]`, false)
                })
            }
            case 'object': {
                if (!value || typeof value !== 'object' || Array.isArray(value)) {
                    warnings.push(`${path}: object field value was not an object, kept as-is`)
                    return value
                }
                return validateProps(value, field.objectFields ?? {}, path, false)
            }
            case 'select':
            case 'radio': {
                const options = Array.isArray(field.options) ? field.options : []
                if (options.length && !options.some((o: AnyRecord) => o?.value === value)) {
                    warnings.push(
                        `${path}: ${JSON.stringify(value)} is not a listed option, dropped ` +
                        `(component default applies)`,
                    )
                    return DROP
                }
                return value
            }
            case 'number': {
                const numeric =
                    typeof value === 'number'
                        ? value
                        : typeof value === 'string' && value.trim() !== ''
                          ? Number(value)
                          : Number.NaN
                if (!Number.isFinite(numeric)) {
                    warnings.push(`${path}: ${JSON.stringify(value)} is not a number, dropped`)
                    return DROP
                }
                // Honour the bounds the field itself declares, so an AI-suggested
                // 10000px gap or a negative column count cannot reach the canvas.
                const min = typeof field.min === 'number' ? field.min : undefined
                const max = typeof field.max === 'number' ? field.max : undefined
                if (min !== undefined && numeric < min) {
                    warnings.push(`${path}: ${numeric} below min ${min}, clamped`)
                    return min
                }
                if (max !== undefined && numeric > max) {
                    warnings.push(`${path}: ${numeric} above max ${max}, clamped`)
                    return max
                }
                return numeric
            }
            default:
                return value
        }
    }

    /** Strip unknown keys, recurse known ones. `isComponentProps` keeps `id`. */
    const validateProps = (
        props: AnyRecord,
        fields: AnyRecord,
        path: string,
        isComponentProps: boolean,
    ): AnyRecord => {
        const out: AnyRecord = {}
        for (const [key, value] of Object.entries(props)) {
            if (isComponentProps && key === 'id') {
                out.id = value
                continue
            }
            const field = fields?.[key]
            if (!field) {
                // Unknown prop: drop it so it cannot poison editor state.
                warnings.push(`${path}.${key}: unknown prop stripped`)
                continue
            }
            const validated = validateFieldValue(value, field, `${path}.${key}`)
            if (validated === DROP) continue
            out[key] = validated
        }
        return out
    }

    const validateComponent = (item: any, path: string): AnyRecord | null => {
        if (!item || typeof item !== 'object') {
            problems.push(`${path}: component entry is not an object`)
            return null
        }
        const type = item.type
        if (typeof type !== 'string' || !components[type]) {
            problems.push(`${path}: unknown component type ${JSON.stringify(type)}`)
            return null
        }
        const fields: AnyRecord = components[type].fields ?? {}
        const rawProps = item.props && typeof item.props === 'object' ? item.props : {}

        // Claim this component's id BEFORE descending into slots, so a parent
        // always keeps its id over a nested duplicate (ids anchor zones/history).
        let id = typeof rawProps.id === 'string' ? rawProps.id : ''
        if (!id || seenIds.has(id)) {
            if (id) warnings.push(`${path}: duplicate id ${id} regenerated`)
            id = newId(type)
        }
        seenIds.add(id)

        const props = validateProps(rawProps, fields, `${path}<${type}>`, true)
        props.id = id
        return { type, props }
    }

    const content = proposed.content
        .map((item: any, i: number) => validateComponent(item, `content[${i}]`))
        .filter(Boolean)

    const zones: AnyRecord = {}
    if (proposed.zones && typeof proposed.zones === 'object') {
        for (const [zone, items] of Object.entries(proposed.zones)) {
            if (!Array.isArray(items)) {
                warnings.push(`zones.${zone}: not an array, dropped`)
                continue
            }
            zones[zone] = items
                .map((item: any, i: number) => validateComponent(item, `zones.${zone}[${i}]`))
                .filter(Boolean)
        }
    }

    // Root: keep only props that exist in the root field schema (title always allowed).
    const rootFields: AnyRecord = config?.root?.fields ?? { title: { type: 'text' } }
    const proposedRootProps: AnyRecord =
        proposed.root?.props && typeof proposed.root.props === 'object'
            ? proposed.root.props
            : typeof proposed.root === 'object' && proposed.root !== null
              ? proposed.root
              : {}
    const rootProps: AnyRecord = {}
    for (const [key, value] of Object.entries(proposedRootProps)) {
        if (key === 'props') continue
        if (key === 'title' || rootFields[key]) {
            const validated = validateFieldValue(value, rootFields[key] ?? { type: 'text' }, `root.${key}`)
            if (validated !== DROP) rootProps[key] = validated
        } else {
            warnings.push(`root.${key}: unknown root prop stripped`)
        }
    }

    if (problems.length) {
        throw new PuckValidationError(problems)
    }

    const data: AnyRecord = { root: { props: rootProps }, content }
    if (Object.keys(zones).length) data.zones = zones
    return { data, warnings }
}
