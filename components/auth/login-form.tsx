"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Errors = Partial<Record<"email" | "password", string>>

/*
 * UI-only sign-in until Clerk exists: validates the form, then hands off to
 * /dashboard, whose layout sends candidates without a profile to onboarding.
 */
export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)

  const submit = () => {
    const next: Errors = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address."
    if (!password) next.password = "Enter your password."
    setErrors(next)
    if (Object.keys(next).length) return
    setSubmitting(true)
    router.push("/dashboard")
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="grid gap-5"
    >
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          className="h-11"
          value={email}
          aria-invalid={!!errors.email}
          onChange={(e) => {
            setEmail(e.target.value)
            setErrors((er) => ({ ...er, email: undefined }))
          }}
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          className="h-11"
          value={password}
          aria-invalid={!!errors.password}
          onChange={(e) => {
            setPassword(e.target.value)
            setErrors((er) => ({ ...er, password: undefined }))
          }}
        />
        {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
      </div>

      <Button type="submit" className="mt-2 h-11 text-[15px]" disabled={submitting}>
        {submitting && <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" data-icon="inline-start" />}
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  )
}
