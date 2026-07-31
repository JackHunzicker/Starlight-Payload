import { createHmac, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'

const port = Number(process.env.MOCK_BTCPAY_PORT || 18999)
const browserOrigin = process.env.MOCK_BTCPAY_BROWSER_ORIGIN || `http://localhost:${port}`
const webhookUrl = process.env.MOCK_BTCPAY_WEBHOOK_URL || 'http://localhost:7774/payments/btcpay/webhook'
const webhookSecret = process.env.MOCK_BTCPAY_WEBHOOK_SECRET || 'integration-webhook-secret'
const invoices = new Map()

function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(value))
}

async function readJson(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

async function settle(invoice) {
  invoice.status = 'Settled'
  invoice.additionalStatus = 'None'
  const event = Buffer.from(JSON.stringify({
    deliveryId: randomUUID(),
    type: 'InvoiceSettled',
    timestamp: Date.now(),
    storeId: invoice.storeId,
    invoiceId: invoice.id,
  }))
  const signature = `sha256=${createHmac('sha256', webhookSecret).update(event).digest('hex')}`
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'BTCPay-Sig': signature },
    body: event,
  })
  if (!response.ok) throw new Error(`Vendure webhook returned ${response.status}: ${await response.text()}`)
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host}`)
    const createMatch = url.pathname.match(/^\/api\/v1\/stores\/([^/]+)\/invoices$/)
    const getMatch = url.pathname.match(/^\/api\/v1\/stores\/([^/]+)\/invoices\/([^/]+)$/)
    const checkoutMatch = url.pathname.match(/^\/i\/([^/]+)$/)

    if (request.method === 'POST' && createMatch) {
      if (request.headers.authorization !== 'token integration-api-key') return sendJson(response, 401, { message: 'invalid token' })
      const input = await readJson(request)
      const id = randomUUID()
      const invoice = {
        id,
        storeId: decodeURIComponent(createMatch[1]),
        amount: String(input.amount),
        currency: input.currency,
        checkoutLink: `${browserOrigin}/i/${id}`,
        status: 'New',
        additionalStatus: 'None',
        metadata: input.metadata,
        redirectURL: input.checkout?.redirectURL,
      }
      invoices.set(id, invoice)
      return sendJson(response, 200, invoice)
    }

    if (request.method === 'GET' && getMatch) {
      const invoice = invoices.get(decodeURIComponent(getMatch[2]))
      return invoice ? sendJson(response, 200, invoice) : sendJson(response, 404, { message: 'not found' })
    }

    if (request.method === 'GET' && checkoutMatch) {
      const invoice = invoices.get(decodeURIComponent(checkoutMatch[1]))
      if (!invoice) return sendJson(response, 404, { message: 'not found' })
      await settle(invoice)
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      return response.end(`<!doctype html><html><head><title>Mock BTCPay Checkout</title></head><body style="font-family:system-ui;max-width:42rem;margin:4rem auto;padding:1rem"><h1>Bitcoin payment settled</h1><p>Invoice ${invoice.id}</p><p>${invoice.amount} ${invoice.currency}</p><a href="${invoice.redirectURL}">Return to Acme Commerce</a></body></html>`)
    }

    sendJson(response, 404, { message: 'not found' })
  } catch (error) {
    sendJson(response, 500, { message: error instanceof Error ? error.message : String(error) })
  }
})

server.listen(port, '0.0.0.0', () => console.log(`Mock BTCPay listening on ${port}`))
