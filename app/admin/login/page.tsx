"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Loader2, ShieldAlert, TriangleAlert } from "lucide-react";
import { SokoMark } from "@/components/soko-mark";
import { adminApiAvailable, adminLogin } from "@/lib/admin/api";
import { completeAdminLogin } from "@/lib/admin/store";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Use your operator email address.");
    if (!password) return setError("Enter your password.");

    setBusy(true);
    setError("");
    try {
      const session = await adminLogin(email.trim(), password);
      completeAdminLogin(session.token);
      router.push("/admin");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-forest-950 px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-2.5">
          <SokoMark className="size-10" />
          <div>
            <p className="text-[16px] font-extrabold tracking-tight text-white">SokoOS</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand">
              Operator console
            </p>
          </div>
        </div>

        {!adminApiAvailable() ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
            <h1 className="text-[20px] font-extrabold leading-tight tracking-[-0.02em] text-white">
              No API to sign in to
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-forest-200">
              This build has no <code className="text-brand">NEXT_PUBLIC_API_URL</code> configured,
              so there is nowhere to send a sign-in request. Set it to the deployed API&rsquo;s address
              and redeploy.
            </p>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
            <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.03em] text-white">
              Staff sign in
            </h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-forest-200">
              This console can suspend merchants and read platform-wide figures. Every sign-in and
              every action is checked and recorded on the server, not in this browser.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-3.5" noValidate>
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-forest-200">
                  Operator email
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@sokoos.app"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3.5 text-[15px] text-white placeholder:text-forest-200/50 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/20"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-forest-200">
                  Password
                </span>
                <span className="relative block">
                  <input
                    type={reveal ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3.5 pr-11 text-[15px] text-white focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/20"
                  />
                  <button
                    type="button"
                    onClick={() => setReveal((v) => !v)}
                    aria-label={reveal ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-200 hover:text-white"
                  >
                    {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </span>
              </label>

              {error && (
                <p className="flex items-start gap-2 text-[12px] font-medium text-[#ffb4b4]">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand text-[15px] font-bold text-brand-ink transition-[filter] hover:brightness-95 disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" strokeWidth={2.6} />}
                Sign in
              </button>
            </form>
          </div>
        )}

        <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-[#f0b44a]/25 bg-[#f0b44a]/10 p-3.5">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[#f0b44a]" />
          <p className="text-[12px] leading-relaxed text-[#f7d59a]">
            <span className="font-bold">Merchants here are real.</span> The Overview, Revenue,
            Storefronts, Support and System pages beyond this login still show sample data — this
            console&rsquo;s first real slice is sign-in and the merchant list, wired to the actual
            platform database.
          </p>
        </div>

        <p className="mt-5 text-center text-[12px] text-forest-200/60">
          Looking for your own shop?{" "}
          <Link href="/login" className="font-semibold text-brand hover:underline">
            Seller sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
