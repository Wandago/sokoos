"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { AuthFrame, PASSWORD_NOTE } from "@/components/auth-frame";
import { Hydrated } from "@/components/ui/hydrated";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useStore, slugify } from "@/lib/store";
import { industries } from "@/lib/industries";
import { cn } from "@/lib/cn";

export default function SignUpPage() {
  return (
    <Hydrated fallback={<div className="min-h-dvh bg-bg" />}>
      <SignUpScreen />
    </Hydrated>
  );
}

type Step = "you" | "business" | "site";

const steps: { id: Step; label: string }[] = [
  { id: "you", label: "You" },
  { id: "business", label: "Business" },
  { id: "site", label: "Your site" },
];

function SignUpScreen() {
  const { signUp, updateStorefront } = useStore();
  const router = useRouter();
  const [step, setStep] = useState<Step>("you");
  const [industryId, setIndustryId] = useState("fashion");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [till, setTill] = useState("");
  const [location, setLocation] = useState("Nairobi, Kenya");
  const [tagline, setTagline] = useState("");

  const slug = slugify(businessName) || "your-shop";
  const index = steps.findIndex((s) => s.id === step);

  const goNext = () => {
    setError("");
    if (step === "you") {
      if (name.trim().length < 2) return setError("Tell us what to call you.");
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("That doesn't look like an email address.");
      if (password.length < 8) return setError("Use at least 8 characters.");
      return setStep("business");
    }
    if (step === "business") {
      if (businessName.trim().length < 2) return setError("Your business needs a name.");
      if (phone.replace(/\D/g, "").length < 9) return setError("Add a phone number customers can reach.");
      return setStep("site");
    }
    // Creating the account also creates the mini site — one is not useful
    // without the other.
    signUp({ name, email, phone, businessName, tillNumber: till, location, industryId });
    if (tagline.trim()) updateStorefront({ tagline: tagline.trim() });
    try {
      window.localStorage.setItem("sokoos.onboarded", "1");
    } catch {
      // ignore
    }
    router.push("/storefront/?new=1");
  };

  return (
    <AuthFrame
      title={
        step === "you"
          ? "Create your account."
          : step === "business"
            ? "Tell us about the business."
            : "Your site is ready."
      }
      subtitle={
        step === "you"
          ? "Two minutes, and your next order has somewhere to live."
          : step === "business"
            ? "This is what customers see on your orders and your site."
            : "You get a mini site the moment you sign up. Customise it however you like."
      }
      points={[
        "Free to start, no card",
        "A mini site with your products, from day one",
        "Orders, payments and delivery in one book",
      ]}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand-text hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {/* Progress */}
      <ol className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <li key={s.id} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                i < index
                  ? "bg-brand text-brand-ink"
                  : i === index
                    ? "bg-panel text-brand"
                    : "bg-surface-sunken text-text-muted",
              )}
            >
              {i < index ? <Check className="size-3" strokeWidth={3.2} /> : i + 1}
            </span>
            <span
              className={cn(
                "text-[12px] font-semibold",
                i === index ? "text-text" : "text-text-muted",
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-border" />}
          </li>
        ))}
      </ol>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          goNext();
        }}
        className="space-y-4"
        noValidate
      >
        {step === "you" && (
          <>
            <Field label="Your name">
              <Input
                autoComplete="name"
                placeholder="Louis Wandago"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@business.co.ke"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password" error={error || undefined} hint="At least 8 characters.">
              <span className="relative block">
                <Input
                  type={reveal ? "text" : "password"}
                  autoComplete="new-password"
                  className="pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
            <p className="flex items-start gap-2 rounded-2xl bg-surface-sunken p-3 text-[12px] leading-relaxed text-text-secondary">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-text" />
              {PASSWORD_NOTE}
            </p>
          </>
        )}

        {step === "business" && (
          <>
            <Field label="Business name" error={error || undefined}>
              <Input
                placeholder="Zawadi Collection"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" hint="Customers order here.">
                <Input
                  inputMode="tel"
                  placeholder="0722 000 145"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
              <Field label="Till number" hint="Optional.">
                <Input
                  inputMode="numeric"
                  placeholder="5240119"
                  value={till}
                  onChange={(e) => setTill(e.target.value.replace(/\D/g, ""))}
                />
              </Field>
            </div>
            <Field label="Where you sell from">
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </Field>

            {/* The trade decides how stock is counted and what the first screen
                holds. A blank Products page is where these apps die. */}
            <div>
              <p className="mb-2 text-[13px] font-semibold text-text-secondary">
                What trade is this?
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {industries.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setIndustryId(option.id)}
                    aria-pressed={industryId === option.id}
                    className={cn(
                      "flex items-center gap-2.5 rounded-2xl border p-3 text-left transition-colors",
                      industryId === option.id
                        ? "border-brand bg-brand-soft"
                        : "border-border bg-surface hover:bg-surface-hover",
                    )}
                  >
                    <span className="text-[20px]">{option.emoji}</span>
                    <span className="min-w-0 text-[12px] font-semibold leading-tight">
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2.5 text-[12px] leading-relaxed text-text-muted">
                {industries.find((i) => i.id === industryId)?.blurb} You can change this and add
                anything you like — it only decides where you start.
              </p>
            </div>
          </>
        )}

        {step === "site" && (
          <>
            <div className="rounded-card border border-border-subtle bg-surface p-4">
              <p className="text-[12px] font-semibold text-text-secondary">Your address</p>
              <p className="mt-1 break-all text-[16px] font-bold tracking-tight">
                sokoos.app/store/<span className="text-brand-text">{slug}</span>
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-text-muted">
                Every product you add to SokoOS can appear here. Share it in your bio and take
                orders straight to WhatsApp.
              </p>
            </div>
            <Field
              label="One line about the business"
              hint="You can change this and everything else in the editor."
            >
              <Input
                placeholder="Ankara, linen and everyday pieces, made in Nairobi."
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
              />
            </Field>
          </>
        )}

        <div className="flex gap-3 pt-1">
          {index > 0 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setError("");
                setStep(steps[index - 1].id);
              }}
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
          )}
          <Button type="submit" full size="lg">
            {step === "site" ? "Create my account" : "Continue"}
            <ArrowRight className="size-4" strokeWidth={2.6} />
          </Button>
        </div>
      </form>
    </AuthFrame>
  );
}
