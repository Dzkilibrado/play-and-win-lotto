import type { ReactNode } from "react";

import { PageHeader } from "@/components/layout/PageHeader";

/** Cabeçalho comum das telas internas da Administração (o "Voltar" vem do layout). */
export function AdminSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <PageHeader title={title} description={description} />
      {children}
    </div>
  );
}
