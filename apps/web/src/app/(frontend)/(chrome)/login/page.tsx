import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/session'
import { LoginForm } from './LoginForm'

export const metadata = {
    title: 'Sign In | Acme Commerce',
    description: 'Sign in to your Acme Commerce account',
}

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
    if (await getCurrentSession()) {
        redirect('/account')
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-card p-8 shadow-lg">
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome back</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Sign in to see your orders and account details.
                    </p>
                </div>

                <LoginForm />

                <p className="text-center text-xs text-muted-foreground">
                    By continuing you agree to our{' '}
                    <Link href="/terms-of-service/" className="underline underline-offset-2 hover:text-foreground">
                        terms of service
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy-policy/" className="underline underline-offset-2 hover:text-foreground">
                        privacy policy
                    </Link>
                    .
                </p>
            </div>
        </div>
    )
}
