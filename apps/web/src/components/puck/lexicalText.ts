/**
 * Renders Lexical richText as plain readable lines.
 *
 * Extracted from CourseDetailBlock so it can be unit-tested without pulling a
 * `'use client'` block (and its three.js/Remotion imports) into the test
 * runtime.
 *
 * History: the original code pushed `JSON.stringify(description)` through
 * `dangerouslySetInnerHTML` — raw Lexical JSON on the page and an unnecessary
 * innerHTML sink. The replacement then flattened lists into one run-on line;
 * `list`/`listitem` nodes are now handled so each item keeps its own line.
 */

const collectText = (node: any): string =>
    typeof node?.text === 'string'
        ? node.text
        : Array.isArray(node?.children)
          ? node.children.map(collectText).join('')
          : ''

export function lexicalParagraphs(value: unknown): string[] {
    if (!value) return []
    if (typeof value === 'string') return value.split('\n').filter(Boolean)
    const root = (value as any)?.root
    if (!root?.children) return []

    const lines: string[] = []

    const walk = (node: any) => {
        if (node?.type === 'list') {
            const ordered = node.listType === 'number'
            const items = Array.isArray(node.children) ? node.children : []
            items.forEach((item: any, index: number) => {
                const children = Array.isArray(item?.children) ? item.children : []
                const nestedLists = children.filter((child: any) => child?.type === 'list')
                const ownText = children
                    .filter((child: any) => child?.type !== 'list')
                    .map(collectText)
                    .join('')
                    .trim()
                if (ownText) {
                    const marker = ordered ? `${(node.start ?? 1) + index}. ` : '• '
                    lines.push(`${marker}${ownText}`)
                }
                nestedLists.forEach(walk)
            })
            return
        }
        const text = collectText(node).trim()
        if (text) lines.push(text)
    }

    root.children.forEach(walk)
    return lines
}
