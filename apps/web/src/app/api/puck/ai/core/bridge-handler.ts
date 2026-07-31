/**
 * Bridge path for the Puck in-editor AI chat.
 *
 * Forwards the editor's request to the local puck-claude-bridge (which runs
 * `claude -p` under the operator subscription OAuth) and translates Claude Code's
 * stream-json output into the AI SDK v6 UI message stream that
 * @puckeditor/plugin-ai consumes.
 *
 * PROTOCOL ADAPTER — versioned against @puckeditor/plugin-ai@0.7.0:
 *   - chat text        → start / text-start / text-delta / text-end / finish
 *   - canvas update    → data-puck-actions: [{ type: 'setData', data }]
 *                        (dispatched via puckDispatch; 0.7.0 has NO data-page)
 *   - chat id handoff  → data-new-chat-created: { chatId }
 *   - completion       → data-finish (payload ignored by 0.7.0 client)
 * Re-verify these cases in plugin-ai dist processData() after any upgrade.
 *
 * The proposal only mutates editor canvas state. Saving/publishing stays a
 * deliberate human action in the Puck UI.
 */
import { NextRequest } from 'next/server'
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import { buildComponentContract, buildTurnPrompt, PUCKDATA_FENCE } from './bridge-prompt'
import { validatePuckData, PuckValidationError } from './validate-puck-data'

type AnyRecord = Record<string, any>

const BRIDGE_URL = () => process.env.PUCK_AI_BRIDGE_URL || 'http://127.0.0.1:8765'
const BRIDGE_SECRET = () => process.env.PUCK_AI_BRIDGE_SECRET || ''

const newChatId = () => `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** Last user message text from an AI SDK v6 UIMessage[] payload. */
function extractUserText(messages: AnyRecord[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i]
        if (m?.role !== 'user') continue
        const parts = Array.isArray(m.parts) ? m.parts : []
        const text = parts
            .filter((p: AnyRecord) => p?.type === 'text' && typeof p.text === 'string')
            .map((p: AnyRecord) => p.text)
            .join('\n')
            .trim()
        if (text) return text
    }
    return ''
}

function extractPuckdataBlock(fullText: string): AnyRecord | null {
    const start = fullText.indexOf(PUCKDATA_FENCE)
    if (start < 0) return null
    const afterFence = fullText.slice(start + PUCKDATA_FENCE.length)
    const end = afterFence.indexOf('```')
    const raw = (end >= 0 ? afterFence.slice(0, end) : afterFence).trim()
    const parsed = JSON.parse(raw)
    return parsed?.page && typeof parsed.page === 'object' ? parsed.page : parsed
}

export async function invokeBridgeAi(req: NextRequest): Promise<Response> {
    let body: AnyRecord
    try {
        body = await req.json()
    } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { messages, pageData, config } = body
    if (!Array.isArray(messages) || !config?.components) {
        return Response.json({ error: 'messages and config are required' }, { status: 400 })
    }
    if (!BRIDGE_SECRET()) {
        return Response.json(
            { error: 'PUCK_AI_MODE=bridge but PUCK_AI_BRIDGE_SECRET is not configured' },
            { status: 500 },
        )
    }

    const isNewChat = typeof body.chatId !== 'string' || body.chatId.length === 0
    const chatId = isNewChat ? newChatId() : body.chatId
    let userText = extractUserText(messages)
    if (!userText) {
        return Response.json({ error: 'No user message text found' }, { status: 400 })
    }
    if (body.trigger === 'regenerate-message') {
        userText = `The editor asked you to REGENERATE your previous answer. Produce a fresh take on this request:\n${userText}`
    }

    const prompt = buildTurnPrompt({
        userText,
        pageData: pageData ?? { root: { props: {} }, content: [] },
        contract: buildComponentContract(config),
        pageTitle: pageData?.root?.props?.title,
    })

    // Connect to the local bridge before opening the UI stream so connection
    // failures surface as a clean HTTP error state in the chat.
    let bridgeRes: Response
    try {
        bridgeRes = await fetch(`${BRIDGE_URL()}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-bridge-secret': BRIDGE_SECRET(),
            },
            body: JSON.stringify({ chatId, prompt }),
            signal: req.signal,
        })
    } catch {
        return Response.json(
            {
                error:
                    'Local Claude bridge is offline. Start it on the host: tools\\puck-claude-bridge\\start-bridge.ps1',
            },
            { status: 503 },
        )
    }
    if (!bridgeRes.ok || !bridgeRes.body) {
        const detail = await bridgeRes.text().catch(() => '')
        return Response.json(
            { error: `Bridge refused the request (${bridgeRes.status}): ${detail.slice(0, 300)}` },
            { status: 502 },
        )
    }
    const bridgeBody = bridgeRes.body

    const stream = createUIMessageStream({
        onError: (e) => (e instanceof Error ? e.message : String(e)),
        execute: async ({ writer }) => {
            const write = (chunk: AnyRecord) => writer.write(chunk as any)

            write({ type: 'start' })
            if (isNewChat) {
                write({ type: 'data-new-chat-created', data: { chatId }, transient: true })
            }

            const textId = 'claude-reply'
            let textStarted = false
            let fenceSeen = false
            let pending = '' // streamed text held back until we know it is not the fence
            let resultEvt: AnyRecord | null = null
            let bridgeError: string | null = null

            const ensureTextStarted = () => {
                if (!textStarted) {
                    write({ type: 'text-start', id: textId })
                    textStarted = true
                }
            }
            const emitDelta = (delta: string) => {
                if (!delta) return
                ensureTextStarted()
                write({ type: 'text-delta', id: textId, delta })
            }
            /** Stream chat text, but never stream the puckdata payload. */
            const onStreamedText = (t: string) => {
                if (fenceSeen) return
                pending += t
                const idx = pending.indexOf(PUCKDATA_FENCE)
                if (idx >= 0) {
                    fenceSeen = true
                    emitDelta(pending.slice(0, idx).replace(/\s+$/, ''))
                    pending = ''
                    return
                }
                const safe = pending.length - (PUCKDATA_FENCE.length - 1)
                if (safe > 0) {
                    emitDelta(pending.slice(0, safe))
                    pending = pending.slice(safe)
                }
            }

            // ---- consume bridge NDJSON -------------------------------------
            const reader = bridgeBody.getReader()
            const decoder = new TextDecoder()
            let lineBuf = ''
            const handleLine = (line: string) => {
                if (!line.trim()) return
                let evt: AnyRecord
                try {
                    evt = JSON.parse(line)
                } catch {
                    return
                }
                switch (evt.type) {
                    case 'stream_event': {
                        const delta = evt.event?.type === 'content_block_delta' ? evt.event.delta : null
                        if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
                            onStreamedText(delta.text)
                        }
                        return
                    }
                    case 'result':
                        resultEvt = evt
                        return
                    case 'bridge-error':
                        bridgeError = evt.message || 'unknown bridge error'
                        return
                    default:
                        return // init/system/assistant/meta events need no translation
                }
            }
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                lineBuf += decoder.decode(value, { stream: true })
                let nl
                while ((nl = lineBuf.indexOf('\n')) >= 0) {
                    handleLine(lineBuf.slice(0, nl))
                    lineBuf = lineBuf.slice(nl + 1)
                }
            }
            handleLine(lineBuf)

            if (bridgeError && !resultEvt) {
                throw new Error(bridgeError)
            }
            if (!resultEvt) {
                throw new Error('Claude session ended without a result')
            }
            const result: AnyRecord = resultEvt
            if (result.is_error) {
                throw new Error(typeof result.result === 'string' ? result.result : 'Claude reported an error')
            }

            const fullText: string = typeof result.result === 'string' ? result.result : ''
            if (!fenceSeen && !pending && !textStarted && fullText) {
                // Partial streaming produced nothing (e.g. resume quirk) — fall
                // back to the authoritative result text.
                onStreamedText(fullText)
            }
            if (!fenceSeen && pending) emitDelta(pending.replace(/\s+$/, ''))
            pending = ''

            // ---- proposed page data → validated setData action -------------
            let statusNote = ''
            const hasFence = fullText.includes(PUCKDATA_FENCE)
            if (hasFence) {
                try {
                    const proposal = extractPuckdataBlock(fullText)
                    if (proposal) {
                        const { data, warnings } = validatePuckData(proposal, config)
                        write({
                            type: 'data-puck-actions',
                            data: [{ type: 'setData', data }],
                            transient: true,
                        })
                        statusNote =
                            warnings.length > 0
                                ? `\n\n_Canvas updated (${warnings.length} adjustment${warnings.length === 1 ? '' : 's'}: ${warnings.slice(0, 3).join('; ')}${warnings.length > 3 ? '; …' : ''}). Review and Save to keep._`
                                : '\n\n_Canvas updated — review and Save to keep, or undo._'
                    }
                } catch (e) {
                    statusNote =
                        e instanceof PuckValidationError
                            ? `\n\n⚠ _I proposed a page update but it failed validation and was NOT applied: ${e.problems.join('; ')}_`
                            : `\n\n⚠ _I proposed a page update but it could not be parsed, so nothing was applied._`
                }
            }
            if (statusNote) emitDelta(statusNote)

            if (textStarted) write({ type: 'text-end', id: textId })
            const usage: AnyRecord = result.usage ?? {}
            write({
                type: 'data-finish',
                data: {
                    totalCost: 0, // subscription-backed: no metered cost
                    tokenUsage: {
                        inputTokens: usage.input_tokens ?? 0,
                        outputTokens: usage.output_tokens ?? 0,
                        totalTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
                    },
                },
                transient: true,
            })
            write({ type: 'finish' })
        },
    })

    return createUIMessageStreamResponse({ stream })
}
