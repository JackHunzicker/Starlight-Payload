'use client'
import React from 'react'

/**
 * Community access for a signed-in customer.
 *
 * A code, not a sign-on button: Sharkey cannot consume OIDC, and its
 * registration is closed except by invite, so this IS the "accounts tied to the
 * store" mechanism rather than a fallback for one.
 */
export function CommunityInvite({
    communityUrl,
    existingCode,
}: {
    communityUrl: string
    existingCode?: string | null
}) {
    const [code, setCode] = React.useState<string | null>(existingCode ?? null)
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [copied, setCopied] = React.useState(false)

    async function request() {
        setBusy(true)
        setError(null)
        try {
            // Trailing slash on purpose: the app sets `trailingSlash: true`, so
            // '/api/community/invite' answers 308 and costs an extra round-trip.
            const response = await fetch('/api/community/invite/', { method: 'POST' })
            const body = await response.json()
            if (!response.ok) {
                setError(body?.error || 'That did not work. Try again shortly.')
                return
            }
            setCode(body.code)
        } catch {
            setError('That did not work. Try again shortly.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Community
            </h2>
            <div className="rounded-xl border border-border bg-card p-4">
                {code ? (
                    <>
                        <p className="text-sm text-foreground">
                            Your invite code. Enter it when you sign up at{' '}
                            <a href={communityUrl} target="_blank" rel="noopener"
                                className="underline underline-offset-2 hover:text-primary">
                                the community
                            </a>
                            .
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                            <code className="select-all rounded-lg bg-muted px-3 py-2 font-mono text-sm text-foreground">
                                {code}
                            </code>
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        await navigator.clipboard.writeText(code)
                                        setCopied(true)
                                        setTimeout(() => setCopied(false), 2000)
                                    } catch {
                                        // Clipboard can be blocked by permissions; the code is
                                        // select-all above, so there is always a way to take it.
                                    }
                                }}
                                className="rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted"
                            >
                                {copied ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                            One code per account, and it expires — request it when you are ready to join.
                        </p>
                    </>
                ) : (
                    <>
                        <p className="text-sm text-muted-foreground">
                            The community is private. Request an invite code to join.
                        </p>
                        {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
                        <button
                            type="button"
                            onClick={request}
                            disabled={busy}
                            className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground
                                       transition-colors hover:bg-primary/90 disabled:opacity-60
                                       focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        >
                            {busy ? 'Requesting…' : 'Request an invite'}
                        </button>
                    </>
                )}
            </div>
        </section>
    )
}
