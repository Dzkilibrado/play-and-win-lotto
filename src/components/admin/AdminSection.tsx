import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/layout/PageHeader";

/** Cabeçalho comum das telas internas da Administração, com volta clara. */
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
      <Link
        to="/admin"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Administração
      </Link>
      <PageHeader title={title} description={description} />
      {children}
    </div>
  );
}
