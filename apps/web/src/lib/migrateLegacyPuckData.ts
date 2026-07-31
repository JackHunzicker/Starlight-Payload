import type { Data } from '@puckeditor/core'

type PuckItem = Data['content'][number]
type MutableProps = Record<string, any>

const DEFAULT_CONTENT_DIMENSIONS = {
  xs: {
    mode: 'contained',
    alignment: 'center',
    maxWidth: { value: 1200, unit: 'px', enabled: true },
  },
}

const DEFAULT_CONTENT_PADDING = {
  xs: { top: 0, right: 16, bottom: 0, left: 16, unit: 'px', linked: false },
}

function isPuckItem(value: unknown): value is PuckItem {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { type?: unknown; props?: unknown }
  return typeof candidate.type === 'string' && !!candidate.props && typeof candidate.props === 'object'
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return undefined
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function rgbToHex(color: { r?: unknown; g?: unknown; b?: unknown }): string | undefined {
  const channels = [color.r, color.g, color.b]
  if (!channels.every(channel => typeof channel === 'number')) return undefined
  return `#${channels
    .map(channel => Math.max(0, Math.min(255, Math.round(channel as number))).toString(16).padStart(2, '0'))
    .join('')}`
}

function migrateBackground(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const background = value as MutableProps
  if (background.type !== 'solid' || !background.color || background.solid) return value

  const hex = rgbToHex(background.color)
  if (!hex) return value
  const alpha = typeof background.color.a === 'number' ? background.color.a : 1
  return { type: 'solid', solid: { hex, opacity: Math.round(alpha * 100) } }
}

function solidHex(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const background = value as MutableProps
  return typeof background.solid?.hex === 'string' ? background.solid.hex : undefined
}

type SurfaceTone = 'dark' | 'light' | undefined

function surfaceTone(hex: string | undefined): SurfaceTone {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return undefined
  const [r, g, b] = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16))
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45 ? 'dark' : 'light'
}

const SECTION_PADDING_DEFAULT = {
  xs: { top: 48, right: 0, bottom: 48, left: 0, unit: 'px', linked: false },
}

/**
 * Components that no longer exist in the merged Puck config. Puck silently skips
 * unknown types at render time, so retired instances must be rewritten into their
 * current equivalents or their content disappears from the live site.
 */
function migrateRetiredComponent(item: PuckItem, markChanged: () => void): void {
  const props = item.props as MutableProps

  switch (item.type) {
    case 'SharkeyFeedBlock':
      // Direct successor with identical data props plus a feed-type discriminator.
      item.type = 'ExternalFeedBlock'
      props.feedType ??= 'sharkey'
      markChanged()
      break
    case 'CTABlock':
      item.type = 'Section'
      item.props = {
        id: props.id,
        semanticElement: 'section',
        sectionPadding: SECTION_PADDING_DEFAULT,
        contentDimensions: DEFAULT_CONTENT_DIMENSIONS,
        contentPadding: DEFAULT_CONTENT_PADDING,
        content: [
          // Heading.level is the literal tag string ('h2'), not a number — the
          // Delmare renderer passes it straight to createElement.
          { type: 'Heading', props: { id: `${props.id}-heading`, text: props.title ?? '', level: 'h2', alignment: 'center' } },
          { type: 'Text', props: { id: `${props.id}-text`, content: props.description ?? '', alignment: 'center' } },
          { type: 'Button', props: { id: `${props.id}-button`, text: props.buttonText ?? '', link: props.buttonLink ?? '#', variant: 'default' } },
        ],
      }
      markChanged()
      break
    case 'ArticlesSkeletonBlock':
      // Placeholder block; its heading/description are the only real content.
      item.type = 'Section'
      item.props = {
        id: props.id,
        semanticElement: 'section',
        sectionPadding: SECTION_PADDING_DEFAULT,
        contentDimensions: DEFAULT_CONTENT_DIMENSIONS,
        contentPadding: DEFAULT_CONTENT_PADDING,
        content: [
          { type: 'Heading', props: { id: `${props.id}-heading`, text: props.title ?? '', level: 'h2', alignment: 'center' } },
          { type: 'Text', props: { id: `${props.id}-text`, content: props.description ?? '', alignment: 'center' } },
        ],
      }
      markChanged()
      break
  }
}

function normalizeItem(item: PuckItem, inheritedTone: SurfaceTone, markChanged: () => void): void {
  migrateRetiredComponent(item, markChanged)
  const props = item.props as MutableProps
  let childTone = inheritedTone

  const move = (from: string, to: string, transform: (value: any) => any = value => value) => {
    if (props[from] === undefined) return
    if (props[to] === undefined) props[to] = transform(props[from])
    delete props[from]
    markChanged()
  }

  switch (item.type) {
    case 'Section': {
      const isLegacy = props.background !== undefined || props.padding !== undefined || props.element !== undefined
      move('background', 'sectionBackground', migrateBackground)
      move('padding', 'sectionPadding', value => ({ xs: { ...value, linked: value.linked ?? false } }))
      move('element', 'semanticElement')
      if (isLegacy && props.contentDimensions === undefined) {
        props.contentDimensions = DEFAULT_CONTENT_DIMENSIONS
        markChanged()
      }
      if (isLegacy && props.contentPadding === undefined) {
        props.contentPadding = DEFAULT_CONTENT_PADDING
        markChanged()
      }
      childTone = surfaceTone(solidHex(props.sectionBackground)) ?? inheritedTone
      break
    }
    case 'Container': {
      if (props.maxWidth !== undefined) {
        const maxWidth = toNumber(props.maxWidth) ?? 1200
        props.dimensions ??= {
          xs: {
            mode: 'contained',
            alignment: 'center',
            maxWidth: { value: maxWidth, unit: 'px', enabled: true },
          },
        }
        delete props.maxWidth
        markChanged()
      }
      break
    }
    case 'Heading':
      move('align', 'alignment')
      if (typeof props.level === 'number') {
        // Current Heading.level is the tag string ('h2'); numeric levels reach
        // createElement as a number and crash the client render (React #130).
        props.level = `h${props.level}`
        markChanged()
      }
      if (props.size !== undefined) {
        // Retired prop: current Heading has no size field (visual scale comes from
        // `level`) and the renderer already ignores it, so dropping it is a no-op.
        delete props.size
        markChanged()
      }
      if (inheritedTone && props.textColor == null) {
        props.textColor = { hex: inheritedTone === 'dark' ? '#f8fafc' : '#0f172a', opacity: 100 }
        markChanged()
      }
      break
    case 'Text':
      move('text', 'content')
      move('align', 'alignment')
      if (props.color !== undefined) {
        if (props.textColor === undefined && props.color === 'muted-foreground') {
          props.textColor = { hex: inheritedTone === 'dark' ? '#cmpa5e1' : '#475569', opacity: 100 }
        }
        delete props.color
        markChanged()
      } else if (inheritedTone && props.textColor == null) {
        props.textColor = { hex: inheritedTone === 'dark' ? '#cmpa5e1' : '#475569', opacity: 100 }
        markChanged()
      }
      break
    case 'Flex':
      move('padding', 'customPadding')
      if (typeof props.gap === 'string') {
        props.gap = toNumber(props.gap) ?? 24
        markChanged()
      }
      break
    case 'Grid':
      move('columns', 'numColumns')
      if (typeof props.gap === 'string') {
        props.gap = toNumber(props.gap) ?? 24
        markChanged()
      }
      break
    case 'Button':
      move('label', 'text')
      move('href', 'link')
      if (props.variant === 'primary') {
        props.variant = 'default'
        markChanged()
      }
      break
    case 'Spacer':
      move('height', 'size')
      break
    case 'Card':
      move('title', 'heading')
      move('description', 'text')
      break
  }

  for (const value of Object.values(props)) {
    if (Array.isArray(value)) {
      for (const child of value) if (isPuckItem(child)) normalizeItem(child, childTone, markChanged)
    }
  }
}

/**
 * Upgrades saved Puck data from the pre-0.6 schema at the render boundary.
 *
 * Besides converting deprecated top-level DropZones into slot props, this
 * normalizes the renamed layout and content fields used by current
 * payload-puck. The migration is deliberately idempotent so the same helper
 * can safely power the one-time persistence script and historical restores.
 */
export function migrateLegacyPuckData(data: Data): Data {
  let changed = false
  const migrated = structuredClone(data)
  const markChanged = () => { changed = true }

  if (migrated.zones && Object.keys(migrated.zones).length > 0) {
    const itemsById = new Map<string, PuckItem>()
    const indexItems = (items: PuckItem[]) => {
      for (const item of items) if (typeof item.props?.id === 'string') itemsById.set(item.props.id, item)
    }

    indexItems(migrated.content)
    for (const items of Object.values(migrated.zones)) indexItems(items)

    for (const [compound, items] of Object.entries(migrated.zones)) {
      const separator = compound.lastIndexOf(':')
      if (separator < 1) continue
      const component = itemsById.get(compound.slice(0, separator))
      if (component) component.props[compound.slice(separator + 1)] = items
    }
    delete migrated.zones
    markChanged()
  }

  for (const item of migrated.content) normalizeItem(item, undefined, markChanged)
  return changed ? migrated : data
}
