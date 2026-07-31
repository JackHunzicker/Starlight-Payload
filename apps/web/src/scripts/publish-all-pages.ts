import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'

// Publishes every page whose latest state is a draft. Development posture:
// the site is being built end-to-end, so authored pages should be live.
const payload = await getPayload({ config })
const pages = await payload.find({ collection: 'pages', draft: true, limit: 1000, pagination: false })

for (const page of pages.docs) {
  if (page._status === 'published') continue
  await payload.update({
    collection: 'pages',
    id: page.id,
    draft: false,
    data: { _status: 'published' },
  })
  payload.logger.info(`Published page ${page.slug}`)
}

payload.logger.info('Publish pass complete')
process.exit(0)
