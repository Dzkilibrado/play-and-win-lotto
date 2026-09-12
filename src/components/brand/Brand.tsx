import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("grid size-9 shrink-0 grid-cols-3 gap-0.5 rounded-md bg-primary p-2", className)} aria-hidden>
      {Array.from({ length: 9 }, (_, index) => <span key={index} className={cn("rounded-full bg-primary-foreground", index === 4 && "bg-warning")} />)}
    </span>
  );
}

export function Brand({ to = "/", compact = false, className }: { to?: "/" | "/dashboard"; compact?: boolean; className?: string }) {
  return (
    <Link to={to} className={cn("flex min-w-0 items-center gap-2.5", className)} aria-label="Gestor da Sorte">
      <BrandMark />
      {!compact ? <span className="truncate font-display text-base font-semibold text-text-primary">Gestor da Sorte</span> : null}
    </Link>
  );
}
