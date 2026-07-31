/**
 * Prompt + contract construction for the Claude Code bridge path.
 *
 * Every turn sends the full briefing (contract, brand, protocol) plus the
 * current page data. The Claude session itself (resumed by the bridge via
 * --resume) carries the conversational memory; the briefing is stateless so
 * a bridge restart or lost session can never leave Claude without rules.
 */

type AnyRecord = Record<string, any>

// Server-owned brand context — the bridge path equivalent of the Cloud
// handler's `ai.context`. Keep the two in sync when the brand evolves.
export const BRAND_CONTEXT = `You are building pages for Acme Commerce, a orbitlabs research platform.
Brand: "Sanctuary" aesthetic — calming, trustworthy, Apple-tier polish, generous whitespace.
Use Section > Container > content nesting for proper layouts.
Primary color is teal (#0d9488 light / #4ecdc4 dark). Dark backgrounds use #0d1117.
Always use semantic Tailwind classes (bg-background, text-foreground, bg-card, etc.).`

export const PUCKDATA_FENCE = '```puckdata'

/** Compact one field definition to what the model needs to fill it. */
function compactField(field: AnyRecord): AnyRecord {
    if (!field || typeof field !== 'object') return { type: 'unknown' }
    const out: AnyRecord = { type: field.type }
    if (field.label) out.label = field.label
    if (field.ai?.instructions) out.instructions = field.ai.instructions
    if (Array.isArray(field.options)) {
        out.options = field.options.map((o: AnyRecord) => o?.value)
    }
    if (field.type === 'number') {
        if (field.min !== undefined) out.min = field.min
        if (field.max !== undefined) out.max = field.max
    }
    if (field.type === 'array' && field.arrayFields) {
        out.arrayFields = Object.fromEntries(
            Object.entries(field.arrayFields).map(([k, f]) => [k, compactField(f as AnyRecord)]),
        )
    }
    if (field.type === 'object' && field.objectFields) {
        out.objectFields = Object.fromEntries(
            Object.entries(field.objectFields).map(([k, f]) => [k, compactField(f as AnyRecord)]),
        )
    }
    if (field.type === 'slot') {
        if (field.allow) out.allow = field.allow
        if (field.disallow) out.disallow = field.disallow
    }
    return out
}

/**
 * Compact component/field contract from the Puck config posted by the
 * authenticated editor client. Functions are already gone (JSON transport);
 * this trims the rest down to schema + AI instructions.
 */
export function buildComponentContract(config: AnyRecord): AnyRecord {
    const components: AnyRecord = {}
    for (const [name, comp] of Object.entries<AnyRecord>(config?.components ?? {})) {
        const entry: AnyRecord = {}
        if (comp?.label) entry.label = comp.label
        if (comp?.ai?.instructions) entry.instructions = comp.ai.instructions
        entry.fields = Object.fromEntries(
            Object.entries(comp?.fields ?? {}).map(([k, f]) => [k, compactField(f as AnyRecord)]),
        )
        const defaults = comp?.defaultProps
        if (defaults && typeof defaults === 'object') {
            const json = JSON.stringify(defaults)
            // Huge defaults (e.g. seeded slot trees) blow up the prompt; skip them.
            if (json.length <= 2000) entry.defaultProps = defaults
        }
        components[name] = entry
    }
    return {
        root: {
            fields: Object.fromEntries(
                Object.entries(config?.root?.fields ?? { title: { type: 'text' } }).map(([k, f]) => [
                    k,
                    compactField(f as AnyRecord),
                ]),
            ),
        },
        components,
    }
}

export function buildTurnPrompt(opts: {
    userText: string
    pageData: AnyRecord
    contract: AnyRecord
    pageTitle?: string
}): string {
    const { userText, pageData, contract, pageTitle } = opts
    return `You are the page-building assistant inside the Puck visual editor of the Acme Commerce platform. You converse with the human editor and propose page changes.

${BRAND_CONTEXT}

## Component contract (the ONLY components and props that exist)
${JSON.stringify(contract)}

## Current page data${pageTitle ? ` (page: ${JSON.stringify(pageTitle)})` : ''}
The human may have edited the page since your last message — this JSON is the current truth:
${JSON.stringify(pageData)}

## Output protocol (strict)
1. Start with a short conversational reply to the editor (a few sentences at most, no headings). If you are only answering a question, that reply is your whole output.
2. If and only if the request calls for page changes, end your output with exactly one fenced block:
${PUCKDATA_FENCE}
{"page": {"root": {"props": {...}}, "content": [...], "zones": {...optional...}}}
\`\`\`
   containing the COMPLETE updated page data (never a fragment or diff). Nothing may follow the closing fence.
3. Page data rules:
   - Only component types from the contract; props must match their field schemas. Slot-type props contain arrays of child components.
   - Preserve the ids of components you keep; never reuse an id twice. New components get id "<Type>-<random 8+ chars>".
   - Change only what the request requires; leave the rest of the page byte-identical.
   - Real, on-brand copy is welcome, but NEVER invent scientific, medical, legal, or pricing claims — where a fact is needed that you do not have, write neutral placeholder copy marked with [TODO: …].
4. Your proposal only updates the editor canvas. It is not saved and not published; the human reviews and saves manually. Never claim you saved or published anything.

## Editor's request
${userText}`
}
