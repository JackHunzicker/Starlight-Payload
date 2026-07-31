import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'
import { migrateLegacyPuckData } from '@/lib/migrateLegacyPuckData'
import type { Data } from '@puckeditor/core'

const payload = await getPayload({ config })
const pages = await payload.find({
  collection: 'pages',
  draft: false,
  limit: 1000,
  pagination: false,
})

let migratedCount = 0

for (const page of pages.docs) {
  const current = page.puckData as Data | null | undefined
  if (!current) continue
  const migrated = migrateLegacyPuckData(current)
  if (migrated === current) continue

  await payload.update({
    collection: 'pages',
    id: page.id,
    draft: false,
    data: {
      puckData: migrated,
      _status: page._status,
    },
  })
  migratedCount += 1
  payload.logger.info(`Migrated Puck data for page ${page.slug}`)
}

// Second pass: latest drafts. The Puck editor loads draft data RAW (no runtime
// migration on the editor path), so legacy shapes must not survive at rest in
// drafts either. After the published pass above, this only touches pages whose
// newest version is an actual draft still carrying legacy data.
const drafts = await payload.find({
  collection: 'pages',
  draft: true,
  limit: 1000,
  pagination: false,
})

for (const page of drafts.docs) {
  const current = page.puckData as Data | null | undefined
  if (!current) continue
  const migrated = migrateLegacyPuckData(current)
  if (migrated === current) continue

  await payload.update({
    collection: 'pages',
    id: page.id,
    draft: true,
    data: {
      puckData: migrated,
    },
  })
  migratedCount += 1
  payload.logger.info(`Migrated draft Puck data for page ${page.slug}`)
}

payload.logger.info(`Puck data migration complete (${migratedCount} document(s) updated)`)
process.exit(0)
