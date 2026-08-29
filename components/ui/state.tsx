import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-surface-sunken",
        className,
      )}
    >
      <div className="animate-sweep absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-black/[0.04] to-transparent dark:via-white/[0.05]" />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-card border border-dashed border-border px-6 py-12 text-center",
        className,
      )}
    >
      <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-surface-sunken text-text-muted">
        {icon}
      </span>
      <h3 className="text-[15px] font-bold">{title}</h3>
      <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-text-secondary">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-[76px] w-full rounded-card" />
      ))}
    </div>
  );
}
