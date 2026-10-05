import type { Metadata } from "next"

import { LoginForm } from "@/components/auth/login-form"

export const metadata: Metadata = { title: "Sign in" }

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center px-5 py-16">
      <div className="w-full max-w-[400px]">
        <div className="font-logo text-3xl leading-none" aria-label="NovaJobs">
          <span className="text-foreground">Nova</span>
          <span className="text-primary-hover">Jobs</span>
        </div>
        <h1 className="mt-8 text-[28px] leading-tight font-bold tracking-tight">Sign in</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">Pick up where you left off.</p>
        <div className="mt-8 rounded-lg border bg-card p-6">
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
