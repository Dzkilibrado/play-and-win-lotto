import { SlidersHorizontal, X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

/** Chip de filtro ativo, removível. */
export function ActiveFilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-secondary py-1 pl-3 pr-1 text-xs font-medium text-text-primary">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover filtro ${label}`}
        className="flex size-5 items-center justify-center rounded-full text-text-secondary hover:bg-border"
      >
        <X className="size-3" aria-hidden />
      </button>
    </span>
  );
}

/**
 * Barra padrão: busca rápida + filtros principais + mais filtros + ordenação
 * + limpar. Filtros avançados abrem em drawer no mobile.
 */
export function FilterBar({
  search,
  primaryFilters,
  sort,
  advancedFilters,
  activeChips,
  resultCount,
  onClearAll,
  className,
}: {
  search?: ReactNode;
  primaryFilters?: ReactNode;
  sort?: ReactNode;
  advancedFilters?: ReactNode;
  activeChips?: ReactNode;
  resultCount?: number | null;
  onClearAll?: () => void;
  className?: string;
}) {
  const hasChips = Boolean(activeChips);

  return (
    <section
      aria-label="Filtros"
      className={cn("surface-card space-y-3 p-3 sm:p-4", className)}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {search ? <div className="flex-1">{search}</div> : null}
        <div className="flex flex-wrap items-center gap-2">
          {primaryFilters}
          {advancedFilters ? <FilterDrawer>{advancedFilters}</FilterDrawer> : null}
          {sort}
        </div>
      </div>

      {(hasChips || resultCount !== undefined) && (
        <div className="flex flex-wrap items-center gap-2">
          {resultCount !== undefined && resultCount !== null ? (
            <span className="text-xs font-medium text-text-secondary">
              {resultCount} {resultCount === 1 ? "resultado" : "resultados"}
            </span>
          ) : null}
          {activeChips}
          {hasChips && onClearAll ? (
            <Button variant="ghost" size="sm" onClick={onClearAll} className="h-7 px-2 text-xs">
              Limpar tudo
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function FilterDrawer({ children }: { children: ReactNode }) {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm" className="h-11">
          <SlidersHorizontal className="size-4" aria-hidden />
          Mais filtros
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Mais filtros</DrawerTitle>
            <DrawerDescription>Refine a listagem conforme necessário.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-2">{children}</div>
          <DrawerFooter />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
