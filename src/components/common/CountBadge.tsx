import { cn } from "@/lib/utils";

/** Números grandes ficam compactos: 1000 vira "999+". */
export function formatCount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0";
  const total = Math.floor(value);
  return total > 999 ? "999+" : String(total);
}

/** Contador discreto que acompanha o título de uma seção. */
export function CountBadge({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center justify-center rounded-full bg-surface-secondary px-2 text-xs font-semibold tabular-nums text-text-secondary",
        className,
      )}
    >
      {formatCount(value)}
    </span>
  );
}

/** Título + contador percebidos como um único grupo. */
export function SectionTitleWithCount({ title, count }: { title: string; count: number }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="min-w-0 truncate">{title}</span>
      <CountBadge value={count} />
    </span>
  );
}
