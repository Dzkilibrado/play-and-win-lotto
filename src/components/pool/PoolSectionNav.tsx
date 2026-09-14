/**
 * Navegação entre as seções do bolão.
 *
 * Todas as áreas permanecem textualmente visíveis, inclusive no celular.
 * A grade mobile e as abas desktop quebram em linhas, sem rolagem horizontal.
 */
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PoolSection {
  value: string;
  label: string;
}

export function PoolSectionNav({
  sections,
  value,
  onChange,
}: {
  sections: PoolSection[];
  value: string;
  onChange: (value: string) => void;
}) {
  const current = sections.find((section) => section.value === value) ?? sections[0]!;

  return (
    <nav aria-label="Áreas do bolão" className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3 md:hidden">
        <p className="text-sm font-semibold text-text-primary">Áreas do bolão</p>
        <p className="truncate text-xs text-text-secondary">{current?.label}</p>
      </div>
      <div
        role="tablist"
        aria-label="Seções do bolão"
        className="grid min-w-0 grid-cols-2 gap-1 rounded-xl bg-surface-secondary p-1 md:flex md:flex-wrap"
      >
        {sections.map((section) => {
          const activeSection = section.value === current?.value;
          return (
            <Button
              key={section.value}
              type="button"
              role="tab"
              variant="ghost"
              aria-selected={activeSection}
              onClick={() => onChange(section.value)}
              className={cn(
                "h-11 min-w-0 justify-start whitespace-normal px-3 text-left text-sm md:h-10 md:flex-1 md:justify-center md:whitespace-nowrap",
                activeSection
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              {section.label}
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
