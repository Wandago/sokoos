import { cn } from "@/lib/cn";

/**
 * The SokoOS mark — the transaction loop.
 *
 * Two arcs chasing each other around a centre point: conversation becomes an
 * order, the order becomes a payment, the payment becomes a delivery, and the
 * customer comes back around. Reads at 16px, works in one colour.
 */
export function SokoMark({ className, plain }: { className?: string; plain?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center overflow-hidden",
        plain ? "" : "rounded-[28%] bg-brand text-white",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-[68%]">
        <path
          d="M5.2 9.4a7.2 7.2 0 0 1 12.1-2.3"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M18.8 14.6a7.2 7.2 0 0 1-12.1 2.3"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M17.6 3.2v4h-4"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6.4 20.8v-4h4"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="2.4" fill="currentColor" />
      </svg>
    </span>
  );
}
