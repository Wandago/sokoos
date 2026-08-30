"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { AuthFrame, PASSWORD_NOTE } from "@/components/auth-frame";
import { Hydrated } from "@/components/ui/hydrated";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

export default function LoginPage() {
  return (
    <Hydrated fallback={<div className="min-h-dvh bg-bg" />}>
      <LoginScreen />
    </Hydrated>
  );
}

function LoginScreen() {
  const { db, signIn } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState(db.account?.email ?? "");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("That doesn't look like an email address.");
      return;
    }
    if (password.length < 8) {
      setError("Your password is at least 8 characters.");
      return;
    }
    // Only the profile is kept. The password goes no further than this scope.
    signIn(email);
    try {
      window.localStorage.setItem("sokoos.onboarded", "1");
    } catch {
      // Private mode: the tour will simply show again.
    }
    router.push("/");
  };

  return (
    <AuthFrame
      title="Welcome back."
      subtitle="Sign in to pick up where your business left off."
      points={[
        "Every order, payment and delivery in one book",
        "Works offline, on any phone",
        "Your own mini site, ready to share",
      ]}
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="font-semibold text-brand-text hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@business.co.ke"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
          />
        </Field>

        <Field label="Password" error={error || undefined}>
          <span className="relative block">
            <Input
              type={reveal ? "text" : "password"}
              autoComplete="current-password"
              placeholder="At least 8 characters"
              className="pr-12"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
            />
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-text-muted hover:text-text"
            >
              {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </span>
        </Field>

        <Button type="submit" full size="lg">
          Sign in
          <ArrowRight className="size-4" strokeWidth={2.6} />
        </Button>

        <p className="flex items-start gap-2 rounded-2xl bg-surface-sunken p-3 text-[12px] leading-relaxed text-text-secondary">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-text" />
          {PASSWORD_NOTE}
        </p>

        <div className="flex items-center gap-3 py-1">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[12px] font-semibold text-text-muted">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="secondary"
          full
          size="lg"
          onClick={() => {
            signIn("louis@zawadicollection.co.ke");
            try {
              window.localStorage.setItem("sokoos.onboarded", "1");
            } catch {
              // ignore
            }
            router.push("/");
          }}
        >
          Explore with the demo business
        </Button>
      </form>
    </AuthFrame>
  );
}
