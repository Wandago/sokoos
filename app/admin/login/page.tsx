"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, ShieldAlert, TriangleAlert } from "lucide-react";
import { SokoMark } from "@/components/soko-mark";
import { setAdminSession } from "@/lib/admin/store";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Use your operator email address.");
    if (password.length < 8) return setError("Your password is at least 8 characters.");
    if (!/^\d{6}$/.test(code.trim())) return setError("Enter the 6-digit code from your authenticator.");
    // Nothing is verified and nothing is kept: this opens the console UI and
    // no more. Real access control belongs on the server holding the data.
    setAdminSession(true);
    router.push("/admin");
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

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
          <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.03em] text-white">
            Staff sign in
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-forest-200">
            This console can suspend merchants and read platform-wide figures. Access is logged.
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

            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-forest-200">
                Authenticator code
              </span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ""));
                  setError("");
                }}
                className="tabular h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3.5 text-[15px] tracking-[0.4em] text-white placeholder:tracking-[0.4em] placeholder:text-forest-200/40 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/20"
              />
            </label>

            {error && (
              <p className="flex items-start gap-2 text-[12px] font-medium text-[#ffb4b4]">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                {error}
              </p>
            )}

            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand text-[15px] font-bold text-brand-ink transition-[filter] hover:brightness-95"
            >
              Sign in
              <ArrowRight className="size-4" strokeWidth={2.6} />
            </button>
          </form>
        </div>

        {/* Saying this plainly matters more than the screen looking secure. */}
        <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-[#f0b44a]/25 bg-[#f0b44a]/10 p-3.5">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[#f0b44a]" />
          <p className="text-[12px] leading-relaxed text-[#f7d59a]">
            <span className="font-bold">This form does not authenticate anyone.</span> There is no
            server in this build, so it checks the shape of what you type and opens the console.
            Anyone can read the bundle and set the same flag by hand. Before this ships, access has
            to be enforced on the server that holds the data — the UI can only ever hide things.
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
