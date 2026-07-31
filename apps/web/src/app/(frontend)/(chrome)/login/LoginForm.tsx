'use client'
import React from 'react'
import { useRouter } from 'next/navigation'
import { vendureShopRequest } from '@/lib/vendureShop'

/**
 * Sign in and register against Vendure — the identity that owns the orders.
 *
 * Goes through `/api/shop`, never straight to Vendure: that proxy is what puts
 * the session in a first-party httpOnly cookie on this origin and selects the
 * brand's channel from the Host header. A direct call would be cross-origin,
 * would land the token where JavaScript could read it, and would answer from
 * Vendure's default channel.
 */
const LOGIN = /* GraphQL */ `
  mutation Login($username: String!, $password: String!) {
    login(username: $username, password: $password, rememberMe: true) {
      __typename
      ... on CurrentUser { id identifier }
      ... on ErrorResult { errorCode message }
    }
  }
`

const REGISTER = /* GraphQL */ `
  mutation Register($input: RegisterCustomerInput!) {
    registerCustomerAccount(input: $input) {
      __typename
      ... on ErrorResult { errorCode message }
    }
  }
`

type Mode = 'signin' | 'register'

export function LoginForm() {
    const router = useRouter()
    const [mode, setMode] = React.useState<Mode>('signin')
    const [email, setEmail] = React.useState('')
    const [password, setPassword] = React.useState('')
    const [firstName, setFirstName] = React.useState('')
    const [lastName, setLastName] = React.useState('')
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [notice, setNotice] = React.useState<string | null>(null)

    async function submit(event: React.FormEvent) {
        event.preventDefault()
        setBusy(true)
        setError(null)
        setNotice(null)
        try {
            if (mode === 'signin') {
                const data = await vendureShopRequest<{ login: { __typename: string; message?: string } }>(
                    LOGIN,
                    { username: email, password },
                )
                if (data.login.__typename !== 'CurrentUser') {
                    // Vendure distinguishes bad credentials from an unverified
                    // account; surfacing its message avoids inventing our own
                    // wording for a state we do not own.
                    setError(data.login.message || 'Those details were not recognised.')
                    return
                }
                router.push('/account')
                router.refresh()
            } else {
                const data = await vendureShopRequest<{
                    registerCustomerAccount: { __typename: string; message?: string }
                }>(REGISTER, {
                    input: { emailAddress: email, password, firstName, lastName },
                })
                if (data.registerCustomerAccount.__typename !== 'Success') {
                    setError(data.registerCustomerAccount.message || 'That account could not be created.')
                    return
                }
                setNotice(
                    'Check your email to verify the address, then sign in. The link is valid for a limited time.',
                )
                setMode('signin')
            }
        } catch {
            setError('The commerce service is not responding. Try again shortly.')
        } finally {
            setBusy(false)
        }
    }

    const field =
        'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground ' +
        'focus:outline-none focus:ring-2 focus:ring-primary'

    return (
        <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
                <div className="grid grid-cols-2 gap-3">
                    <input className={field} placeholder="First name" autoComplete="given-name"
                        value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                    <input className={field} placeholder="Last name" autoComplete="family-name"
                        value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
            )}
            <input className={field} type="email" placeholder="Email address" autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className={field} type="password" placeholder="Password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {notice && <p role="status" className="text-sm text-foreground">{notice}</p>}

            <button type="submit" disabled={busy}
                className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground
                           transition-colors hover:bg-primary/90 disabled:opacity-60
                           focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>

            <button type="button" onClick={() => { setMode(mode === 'signin' ? 'register' : 'signin'); setError(null) }}
                className="w-full text-center text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground">
                {mode === 'signin' ? 'Need an account? Register' : 'Already have an account? Sign in'}
            </button>
        </form>
    )
}
