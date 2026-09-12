import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme, type ThemePreference } from "@/lib/theme";

const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Automático", icon: Monitor },
];

export function ThemeSelector({ variant = "icon" }: { variant?: "icon" | "list" }) {
  const { theme, setTheme } = useTheme();

  if (variant === "list") {
    return (
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Tema">
        {options.map((option) => {
          const Icon = option.icon;
          const active = theme === option.value;
          return (
            <Button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(option.value)}
              variant="outline"
              className={
                active
                  ? "touch-target justify-start border-primary bg-accent text-accent-foreground"
                  : "touch-target justify-start text-text-secondary"
              }
            >
              <Icon className="size-4" aria-hidden />
              {option.label}
            </Button>
          );
        })}
      </div>
    );
  }

  const Current = options.find((option) => option.value === theme)?.icon ?? Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Alterar tema">
          <Current className="size-5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onSelect={() => setTheme(option.value)}>
            <option.icon className="size-4" aria-hidden />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
