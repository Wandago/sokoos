"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { SokoMark } from "./soko-mark";
import { SpotAllInOne } from "./spot";

/**
 * The shell both auth screens sit in: a forest panel carrying the pitch on the
 * left, the form on the right. On a phone the panel collapses to a header so
 * the form is the first thing in reach.
 */
export function AuthFrame({
  title,
  subtitle,
  children,
  footer,
  points,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  points: string[];
}) {
  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-2">
      {/* Pitch */}
      <aside className="relative overflow-hidden bg-forest-950 px-6 pb-10 pt-8 text-white sm:px-10 lg:flex lg:flex-col lg:justify-between lg:py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 top-1/3 size-[420px] rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--lime-500), transparent 65%)" }}
        />
        <Link href="/landing" className="relative flex items-center gap-2.5">
          <SokoMark className="size-9" />
          <span className="text-[17px] font-extrabold tracking-tight">SokoOS</span>
        </Link>

        <div className="relative mt-8 lg:mt-0">
          <h2 className="max-w-md text-[26px] font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-[34px]">
            Every sale. One place.
          </h2>
          <ul className="mt-6 space-y-3">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-[14px] text-forest-200">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink">
                  <Check className="size-3" strokeWidth={3.2} />
                </span>
                {point}
              </li>
            ))}
          </ul>
          <SpotAllInOne surface="forest" className="mt-10 hidden h-48 w-auto lg:block" />
        </div>

        <p className="relative mt-8 hidden text-[12px] text-forest-200/60 lg:block">
          Made in Nairobi for businesses that sell everywhere.
        </p>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.035em] sm:text-[34px]">
            {title}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-text-secondary">{subtitle}</p>
          <div className="mt-7">{children}</div>
          <div className="mt-6 text-[14px] text-text-secondary">{footer}</div>
        </div>
      </main>
    </div>
  );
}

/**
 * Passwords are collected, checked for shape, and dropped. Nothing verifies one:
 * on a device on its own there is nothing to verify against, and where the API
 * is configured, signing in is a phone number and a code, so a password would
 * be a secret kept for no reason. Keeping it in localStorage would put one on
 * disk in the clear in exchange for nothing.
 */
export const PASSWORD_NOTE =
  "Your password is never stored — not on this device, and not on any server.";
