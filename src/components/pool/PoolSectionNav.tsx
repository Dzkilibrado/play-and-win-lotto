/**
 * Navegação entre as seções do bolão.
 *
 * No celular a lista vira um seletor (bottom sheet do Select), sem rolagem
 * horizontal. No desktop as abas continuam visíveis e quebram em duas linhas
 * quando não cabem — nunca aparece barra de rolagem horizontal.
 */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const current = sections.find((section) => section.value === value) ?? sections[0];

  return (
    <div>
      {/* Celular: seletor de seção */}
      <div className="md:hidden">
        <label className="sr-only" htmlFor="pool-section-select">
          Seção do bolão
        </label>
        <Select value={current?.value} onValueChange={onChange}>
          <SelectTrigger id="pool-section-select" className="h-12 w-full text-sm font-medium">
            <SelectValue placeholder="Escolha a seção" />
          </SelectTrigger>
          <SelectContent>
            {sections.map((section) => (
              <SelectItem key={section.value} value={section.value} className="h-11 text-sm">
                {section.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: abas que quebram linha em vez de rolar */}
      <div
        role="tablist"
        aria-label="Seções do bolão"
        className="hidden flex-wrap gap-1 rounded-xl bg-surface-secondary p-1 md:flex"
      >
        {sections.map((section) => {
          const activeSection = section.value === current?.value;
          return (
            <button
              key={section.value}
              type="button"
              role="tab"
              aria-selected={activeSection}
              onClick={() => onChange(section.value)}
              className={cn(
                "min-h-10 flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                activeSection
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              {section.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
