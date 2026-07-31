/**
 * Puck ↔ Claude Code bridge.
 *
 * Local-only HTTP service that turns authenticated requests from the
 * StarlightPayload web app into `claude -p` invocations running under the operator
 * Windows user, so the Puck in-editor AI chat is powered by the existing
 * Claude subscription OAuth — no ANTHROPIC_API_KEY anywhere.
 *
 * Security model:
 *   - Binds 127.0.0.1 only. Never expose this port or deploy this process
 *     to the VPS: it would turn a personal consumer subscription into a
 *     shared inference service, which the Claude credential policy forbids.
 *   - Every request must carry the shared capability secret
 *     (x-bridge-secret header, PUCK_AI_BRIDGE_SECRET). The secret gates who
 *     may spend subscription quota; it is not an Anthropic credential.
 *   - The Claude OAuth token is owned and refreshed by the Claude Code CLI.
 *     This process never sees or stores it.
 *
 * API (NDJSON in/out):
 *   GET  /health           → { ok, model, activeChats }
 *   POST /chat             body { chatId, prompt } → streams Claude Code
 *                            stream-json lines verbatim, prefixed by one
 *                            { type: "bridge-meta", sessionId, resumed } line.
 *
 * chatId → Claude session mapping persists in sessions.json so each Puck
 * chat resumes its own Claude conversation (--resume <session-id>).
 */

import http from 'node:http'
import { spawn, execSync } from 'node:child_process'
import { randomUUID, timingSafeEqual } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// Config: .env next to this file, real env wins.
// ---------------------------------------------------------------------------
function loadDotEnv(file) {
    if (!fs.existsSync(file)) return
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
        if (!m || line.trim().startsWith('#')) continue
        const val = m[2].replace(/^["']|["']$/g, '')
        if (!(m[1] in process.env)) process.env[m[1]] = val
    }
}
loadDotEnv(path.join(HERE, '.env'))

const SECRET = process.env.PUCK_AI_BRIDGE_SECRET
const PORT = Number(process.env.PUCK_AI_BRIDGE_PORT || 8765)
const MODEL = process.env.PUCK_AI_BRIDGE_MODEL || 'fable'
const EFFORT = process.env.PUCK_AI_BRIDGE_EFFORT || '' // e.g. "medium"; empty = CLI default
const TIMEOUT_MS = Number(process.env.PUCK_AI_BRIDGE_TIMEOUT_MS || 300_000)
const MAX_CONCURRENT = Number(process.env.PUCK_AI_BRIDGE_MAX_CONCURRENT || 2)
const MAX_BODY_BYTES = 2 * 1024 * 1024

if (!SECRET || SECRET.length < 32) {
    console.error('[bridge] PUCK_AI_BRIDGE_SECRET missing or shorter than 32 chars. Refusing to start.')
    process.exit(1)
}

// Claude sessions are stored per working directory; keep a stable, dedicated
// workdir so --resume always finds them and repo CLAUDE.md files stay out of
// the page-building context.
const WORKDIR = path.join(HERE, 'workdir')
const LOGDIR = path.join(HERE, 'logs')
const SESSIONS_FILE = path.join(HERE, 'sessions.json')
fs.mkdirSync(WORKDIR, { recursive: true })
fs.mkdirSync(LOGDIR, { recursive: true })

function resolveClaudeBin() {
    if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN
    try {
        const cmd = process.platform === 'win32' ? 'where claude' : 'command -v claude'
        const lines = execSync(cmd, { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean)
        // Prefer a real executable over npm .cmd shims (spawn-able without a shell).
        return lines.find((l) => l.toLowerCase().endsWith('.exe')) || lines[0]
    } catch {
        return 'claude'
    }
}
const CLAUDE_BIN = resolveClaudeBin()
const NEEDS_SHELL = /\.(cmd|bat)$/i.test(CLAUDE_BIN) || !path.isAbsolute(CLAUDE_BIN)

// ---------------------------------------------------------------------------
// chatId → Claude session persistence
// ---------------------------------------------------------------------------
let sessions = {}
try {
    sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'))
} catch {
    sessions = {}
}
function saveSessions() {
    const tmp = SESSIONS_FILE + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(sessions, null, 2))
    fs.renameSync(tmp, SESSIONS_FILE)
}

const logStream = fs.createWriteStream(path.join(LOGDIR, 'bridge.log'), { flags: 'a' })
function log(...parts) {
    const line = `${new Date().toISOString()} ${parts.join(' ')}`
    console.log(line)
    logStream.write(line + '\n')
}

function authorized(req) {
    const got = req.headers['x-bridge-secret']
    if (typeof got !== 'string') return false
    const a = Buffer.from(got)
    const b = Buffer.from(SECRET)
    return a.length === b.length && timingSafeEqual(a, b)
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = []
        let size = 0
        req.on('data', (c) => {
            size += c.length
            if (size > MAX_BODY_BYTES) {
                reject(new Error('body too large'))
                req.destroy()
                return
            }
            chunks.push(c)
        })
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        req.on('error', reject)
    })
}

function killTree(child) {
    if (!child || child.killed || child.exitCode !== null) return
    try {
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
        } else {
            child.kill('SIGKILL')
        }
    } catch {
        /* already gone */
    }
}

const activeChats = new Set()

async function handleChat(req, res) {
    let body
    try {
        body = JSON.parse(await readBody(req))
    } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `bad request body: ${e.message}` }))
        return
    }
    const { chatId, prompt } = body || {}
    if (typeof chatId !== 'string' || !chatId || typeof prompt !== 'string' || !prompt) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'chatId and prompt are required strings' }))
        return
    }
    if (activeChats.has(chatId)) {
        res.writeHead(409, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'a request for this chat is already running' }))
        return
    }
    if (activeChats.size >= MAX_CONCURRENT) {
        res.writeHead(429, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'bridge at max concurrency, try again shortly' }))
        return
    }

    activeChats.add(chatId)
    const started = Date.now()
    const existing = sessions[chatId]
    const resumed = Boolean(existing?.sessionId)

    const args = [
        '-p',
        '--model', MODEL,
        '--output-format', 'stream-json',
        '--verbose',
        '--include-partial-messages',
        '--tools', '',
        '--max-turns', '1',
    ]
    if (EFFORT) args.push('--effort', EFFORT)
    if (resumed) args.push('--resume', existing.sessionId)
    else args.push('--session-id', randomUUID())

    const child = NEEDS_SHELL
        ? spawn(CLAUDE_BIN, args, { cwd: WORKDIR, shell: true })
        : spawn(CLAUDE_BIN, args, { cwd: WORKDIR })

    res.writeHead(200, {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache',
    })
    res.write(JSON.stringify({ type: 'bridge-meta', resumed, model: MODEL }) + '\n')

    let sessionId = existing?.sessionId || null
    let stderrTail = ''
    let sawResult = false
    let lineBuf = ''

    const timeout = setTimeout(() => {
        log(`[chat ${chatId}] timeout after ${TIMEOUT_MS}ms, killing claude`)
        killTree(child)
    }, TIMEOUT_MS)

    const cleanup = (why) => {
        clearTimeout(timeout)
        if (activeChats.delete(chatId)) {
            log(`[chat ${chatId}] done (${why}) in ${Date.now() - started}ms session=${sessionId ?? 'none'}`)
        }
    }

    req.on('close', () => {
        // Editor cancelled or connection dropped — stop spending quota.
        if (!sawResult) killTree(child)
    })

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
        lineBuf += chunk
        let nl
        while ((nl = lineBuf.indexOf('\n')) >= 0) {
            const line = lineBuf.slice(0, nl).trim()
            lineBuf = lineBuf.slice(nl + 1)
            if (!line) continue
            // Sniff session id + result marker; forward the line verbatim.
            try {
                const evt = JSON.parse(line)
                if (evt.session_id && evt.session_id !== sessionId) {
                    sessionId = evt.session_id
                    sessions[chatId] = { sessionId, updatedAt: new Date().toISOString() }
                    saveSessions()
                }
                if (evt.type === 'result') sawResult = true
            } catch {
                /* non-JSON noise; still forward */
            }
            res.write(line + '\n')
        }
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (c) => {
        stderrTail = (stderrTail + c).slice(-4096)
    })

    child.on('error', (err) => {
        res.write(JSON.stringify({ type: 'bridge-error', message: `failed to spawn claude: ${err.message}` }) + '\n')
        res.end()
        cleanup('spawn-error')
    })
    child.on('close', (code) => {
        if (!sawResult) {
            res.write(
                JSON.stringify({
                    type: 'bridge-error',
                    message: `claude exited (${code}) without a result${stderrTail ? `: ${stderrTail.trim().slice(-500)}` : ''}`,
                }) + '\n',
            )
        }
        res.end()
        cleanup(`exit ${code}`)
    })

    child.stdin.on('error', () => {})
    child.stdin.write(prompt)
    child.stdin.end()

    log(`[chat ${chatId}] started resumed=${resumed} promptBytes=${Buffer.byteLength(prompt)}`)
}

const server = http.createServer(async (req, res) => {
    if (!authorized(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'unauthorized' }))
        return
    }
    try {
        if (req.method === 'GET' && req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true, model: MODEL, activeChats: activeChats.size }))
            return
        }
        if (req.method === 'POST' && req.url === '/chat') {
            await handleChat(req, res)
            return
        }
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'not found' }))
    } catch (e) {
        log('[bridge] unhandled error:', e.stack || e.message)
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'internal bridge error' }))
        } else {
            res.end()
        }
    }
})

server.listen(PORT, '127.0.0.1', () => {
    log(`[bridge] listening on http://127.0.0.1:${PORT} model=${MODEL} claude=${CLAUDE_BIN}`)
})
