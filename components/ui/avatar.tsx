import { initials } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Deterministic tint so the same person always gets the same colour, drawn
 * only from the brand pair — the row reads as one system, not confetti. */
const tints = [
  "bg-brand text-brand-ink",
  "bg-panel text-brand",
  "bg-forest-100 text-forest-800",
  "bg-lime-200 text-forest-800",
];

function tintFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  return tints[hash % tints.length];
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims =
    size === "sm" ? "size-8 text-[11px]" : size === "lg" ? "size-14 text-lg" : "size-10 text-xs";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        dims,
        tintFor(name),
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
