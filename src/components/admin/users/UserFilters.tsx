import { SlidersHorizontal } from "lucide-react";

import { Chip, providerLabel } from "@/components/admin/users/userUi";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { accessRoleLabel, accessRoles } from "@/config/accessModules";

export interface UserFilterValues {
  role?: "USER" | "SUPORTE" | "ADMIN" | undefined;
  provider?: "email" | "google" | undefined;
  created?: "TODAY" | "7D" | "30D" | "90D" | undefined;
  access?: "TODAY" | "7D" | "30D" | "STALE" | "NEVER" | undefined;
}

const createdOptions = [
  ["TODAY", "Hoje"],
  ["7D", "7 dias"],
  ["30D", "30 dias"],
  ["90D", "90 dias"],
] as const;

const accessOptions = [
  ["TODAY", "Hoje"],
  ["7D", "7 dias"],
  ["30D", "30 dias"],
  ["STALE", "Sem acesso recente"],
  ["NEVER", "Nunca acessou"],
] as const;

function Group<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | undefined;
  options: readonly (readonly [T, string])[];
  onChange: (next: T | undefined) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-text-secondary">{label}</legend>
      <div className="flex flex-wrap gap-2">
        <Chip active={value === undefined} onClick={() => onChange(undefined)}>
          Todos
        </Chip>
        {options.map(([key, text]) => (
          <Chip key={key} active={value === key} onClick={() => onChange(key)}>
            {text}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

export function activeFilterCount(values: UserFilterValues): number {
  return [values.role, values.provider, values.created, values.access].filter(Boolean).length;
}

export function UserFilters({
  values,
  providers,
  onChange,
  onClear,
}: {
  values: UserFilterValues;
  providers: string[];
  onChange: (patch: Partial<UserFilterValues>) => void;
  onClear: () => void;
}) {
  const count = activeFilterCount(values);
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm" className="h-10 gap-2">
          <SlidersHorizontal className="size-4" aria-hidden />
          Filtros{count ? ` (${count})` : ""}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>Filtrar usuários</DrawerTitle>
          <DrawerDescription>Toque nas opções para refinar a lista.</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-5 overflow-y-auto px-4 pb-2">
          <Group
            label="Tipo de acesso"
            value={values.role}
            options={accessRoles.map((role) => [role, accessRoleLabel[role]] as const)}
            onChange={(role) => onChange({ role })}
          />
          <Group
            label="Como entra"
            value={values.provider}
            options={providers
              .filter((p): p is "email" | "google" => p === "email" || p === "google")
              .map((p) => [p, providerLabel[p] ?? p] as const)}
            onChange={(provider) => onChange({ provider })}
          />
          <Group
            label="Cadastro"
            value={values.created}
            options={createdOptions}
            onChange={(created) => onChange({ created })}
          />
          <Group
            label="Último acesso"
            value={values.access}
            options={accessOptions}
            onChange={(access) => onChange({ access })}
          />
        </div>
        <DrawerFooter className="flex-row gap-2">
          {count > 0 ? (
            <Button variant="outline" className="h-12 flex-1" onClick={onClear}>
              Limpar
            </Button>
          ) : null}
          <DrawerClose asChild>
            <Button className="h-12 flex-1">Ver resultados</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
