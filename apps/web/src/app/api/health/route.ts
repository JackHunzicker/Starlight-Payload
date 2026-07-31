import { getPayload } from 'payload'
import config from '@payload-config'

export const dynamic = 'force-dynamic'

/**
 * Shallow by default (container healthcheck hits this every 10s — keep it
 * free). `?deep` adds real dependency probes for monitoring and the
 * migration-day smoke: a database round-trip through Payload's pool and
 * Vendure's own health endpoint. Degraded => 503 so any uptime monitor can
 * alert on status code alone.
 */
export async function GET(request: Request) {
  if (!new URL(request.url).searchParams.has('deep')) {
    return Response.json({ status: 'ok', service: 'web' })
  }

  const checks: Record<string, string> = {}

  try {
    const payload = await getPayload({ config })
    await payload.count({ collection: 'users', overrideAccess: true })
    checks.database = 'ok'
  } catch (error) {
    checks.database = error instanceof Error ? error.message : 'failed'
  }

  try {
    const vendureHealthUrl = (
      process.env.VENDURE_INTERNAL_URL || 'http://localhost:7774/shop-api'
    ).replace(/\/shop-api\/?$/, '/health')
    const res = await fetch(vendureHealthUrl, { signal: AbortSignal.timeout(5000) })
    checks.vendure = res.ok ? 'ok' : `status ${res.status}`
  } catch (error) {
    checks.vendure = error instanceof Error ? error.message : 'failed'
  }

  const healthy = Object.values(checks).every((value) => value === 'ok')
  return Response.json(
    { status: healthy ? 'ok' : 'degraded', service: 'web', checks },
    { status: healthy ? 200 : 503 },
  )
}
