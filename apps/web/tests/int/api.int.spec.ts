import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { migrateLegacyPuckData } from '@/lib/migrateLegacyPuckData'

import { describe, it, beforeAll, expect } from 'vitest'

let payload: Payload

describe('API', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
  })

  it('limits anonymous page reads to published documents', async () => {
    const pages = await payload.find({
      collection: 'pages',
      overrideAccess: false,
    })
    expect(pages.docs.length).toBeGreaterThan(0)
    expect(pages.docs.every(page => page._status === 'published')).toBe(true)
  })

  it('limits anonymous course reads to published documents', async () => {
    // Asserted as an invariant rather than against live content: the anonymous
    // result must be exactly the published subset. The previous form required at
    // least one published course to exist, which broke when the demo courses were
    // unpublished in the 2026-07-28 content cleanup — a data assumption, not the
    // security property. This form also fails if a draft ever leaks.
    const anonymous = await payload.find({
      collection: 'courses',
      overrideAccess: false,
    })
    const all = await payload.find({
      collection: 'courses',
      overrideAccess: true,
    })
    const published = all.docs.filter(course => course.status === 'published')
    expect(anonymous.docs.every(course => course.status === 'published')).toBe(true)
    expect(anonymous.totalDocs).toBe(published.length)
  })

  it('migrates deprecated Puck zones into nested slot props', () => {
    const legacy = {
      root: { props: {} },
      content: [{ type: 'Section', props: { id: 'section', content: [] } }],
      zones: {
        'section:content': [{ type: 'Heading', props: { id: 'heading', text: 'Hello' } }],
      },
    }
    const migrated = migrateLegacyPuckData(legacy as never)
    expect(migrated.zones).toBeUndefined()
    expect(migrated.content[0].props.content).toHaveLength(1)
  })

  it('normalizes legacy Puck layout and content fields idempotently', () => {
    const legacy = {
      root: { props: {} },
      content: [{
        type: 'Section',
        props: {
          id: 'hero',
          background: { type: 'solid', color: { r: 13, g: 17, b: 23, a: 1 } },
          padding: { top: 80, right: 0, bottom: 80, left: 0, unit: 'px' },
          element: 'section',
          content: [{
            type: 'Container',
            props: {
              id: 'container',
              maxWidth: '900px',
              content: [
                { type: 'Heading', props: { id: 'heading', text: 'Hello', align: 'center' } },
                { type: 'Text', props: { id: 'text', text: 'World', align: 'center' } },
                { type: 'Button', props: { id: 'button', label: 'Go', href: '/go', variant: 'primary' } },
              ],
            },
          }],
        },
      }],
    }

    const migrated = migrateLegacyPuckData(legacy as never)
    const section = migrated.content[0].props
    const container = section.content[0].props
    expect(section.sectionBackground.solid.hex).toBe('#0d1117')
    expect(section.sectionPadding.xs.top).toBe(80)
    expect(section.contentDimensions.xs.maxWidth.value).toBe(1200)
    expect(container.dimensions.xs.maxWidth.value).toBe(900)
    expect(container.content[0].props.alignment).toBe('center')
    expect(container.content[0].props.textColor.hex).toBe('#f8fafc')
    expect(container.content[1].props.content).toBe('World')
    expect(container.content[2].props).toMatchObject({ text: 'Go', link: '/go', variant: 'default' })
    expect(migrateLegacyPuckData(migrated)).toBe(migrated)
  })

  it('rewrites retired components into their current equivalents', () => {
    const legacy = {
      root: { props: {} },
      content: [
        {
          type: 'SharkeyFeedBlock',
          props: { id: 'feed', apiUrl: 'http://localhost:7777', limit: 20, refreshInterval: 0 },
        },
        {
          type: 'CTABlock',
          props: { id: 'cta', title: 'Join', description: 'Do it.', buttonText: 'Sign Up', buttonLink: '/login' },
        },
        {
          type: 'ArticlesSkeletonBlock',
          props: { id: 'articles', title: 'Articles', description: 'Deep dives.' },
        },
        { type: 'Heading', props: { id: 'hero', text: 'Welcome', level: 1, size: 'xxxl' } }, // numeric level: legacy shape
      ],
    }

    const migrated = migrateLegacyPuckData(legacy as never)
    const [feed, cta, articles, heading] = migrated.content

    expect(feed.type).toBe('ExternalFeedBlock')
    expect(feed.props).toMatchObject({ id: 'feed', feedType: 'sharkey', apiUrl: 'http://localhost:7777', limit: 20 })

    expect(cta.type).toBe('Section')
    expect(cta.props.content.map((child: { type: string }) => child.type)).toEqual(['Heading', 'Text', 'Button'])
    expect(cta.props.content[0].props.text).toBe('Join')
    expect(cta.props.content[0].props.level).toBe('h2')
    expect(cta.props.content[1].props.content).toBe('Do it.')
    expect(cta.props.content[2].props).toMatchObject({ text: 'Sign Up', link: '/login', variant: 'default' })

    expect(articles.type).toBe('Section')
    expect(articles.props.content.map((child: { type: string }) => child.type)).toEqual(['Heading', 'Text'])

    expect(heading.props.size).toBeUndefined()
    expect(heading.props.level).toBe('h1')

    expect(migrateLegacyPuckData(migrated)).toBe(migrated)
  })
})
