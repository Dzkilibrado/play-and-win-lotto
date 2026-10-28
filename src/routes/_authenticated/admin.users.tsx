import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { UserDialogs, type UserDialog } from "@/components/admin/users/UserDialogs";
import { UserFilters, activeFilterCount } from "@/components/admin/users/UserFilters";
import { UserRow } from "@/components/admin/users/UserRow";
import { Chip, providerLabel } from "@/components/admin/users/userUi";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/StateViews";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { accessRoleLabel } from "@/config/accessModules";
import { appConfig } from "@/config/app.config";
import { listAdminUsers } from "@/lib/admin/users.functions";
import { privateQueryKeys } from "@/lib/query/privateQueryKeys";

const searchSchema = z.object({
  page: z.coerce.number().int().positive().optional().catch(undefined),
  status: z.enum(["ACTIVE", "PENDING", "BLOCKED"]).optional().catch(undefined),
  role: z.enum(["USER", "SUPORTE", "ADMIN"]).optional().catch(undefined),
  provider: z.enum(["email", "google"]).optional().catch(undefined),
  created: z.enum(["TODAY", "7D", "30D", "90D"]).optional().catch(undefined),
  access: z.enum(["TODAY", "7D", "30D", "STALE", "NEVER"]).optional().catch(undefined),
  sort: z
    .enum(["CREATED_DESC", "CREATED_ASC", "ACCESS_DESC", "NAME_ASC", "NAME_DESC"])
    .optional()
    .catch(undefined),
});
type Search = z.infer<typeof searchSchema>;
function validateAdminUsersSearch(search: Record<string, unknown>): Search {
  return searchSchema.parse(search);
}

export const Route = createFileRoute("/_authenticated/admin/users")({
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/dashboard", replace: true });
  },
  validateSearch: validateAdminUsersSearch,
  head: () => ({
    meta: [
      { title: `Usuários — ${appConfig.name}` },
      {
        name: "description",
        content: "Administração segura de acesso e recuperação de contas do Gestor da Sorte.",
      },
      { property: "og:title", content: `Usuários — ${appConfig.name}` },
      {
        property: "og:description",
        content: "Administração segura de acesso e recuperação de contas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminUsersPage,
});

const pageSize = 20;

const sortOptions: [NonNullable<Search["sort"]>, string][] = [
  ["CREATED_DESC", "Cadastro mais recente"],
  ["CREATED_ASC", "Cadastro mais antigo"],
  ["ACCESS_DESC", "Último acesso"],
  ["NAME_ASC", "Nome A–Z"],
  ["NAME_DESC", "Nome Z–A"],
];

function AdminUsersPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { user } = Route.useRouteContext();
  const [dialog, setDialog] = useState<UserDialog>(null);

  const page = search.page ?? 1;
  const filters = {
    page,
    pageSize,
    status: search.status ?? null,
    role: search.role ?? null,
    provider: search.provider ?? null,
    createdPeriod: search.created ?? null,
    accessPeriod: search.access ?? null,
    sort: search.sort ?? ("CREATED_DESC" as const),
  };
  const query = useQuery({
    queryKey: privateQueryKeys.adminUsers(user.id, filters),
    queryFn: () => listAdminUsers({ data: filters }),
    staleTime: 30_000,
  });
  const data = query.data;

  const setSearch = (patch: Partial<Search>) =>
    navigate({ search: (previous) => ({ ...previous, ...patch, page: patch.page ?? undefined }) });
  const clearFilters = () => navigate({ search: { sort: search.sort, status: search.status } });
  const filterCount = activeFilterCount(search);

  const statusChips = data
    ? ([
        [undefined, "Todos", data.summary.total],
        ["ACTIVE", "Ativos", data.summary.active],
        ["PENDING", "Pendentes", data.summary.pending],
        ["BLOCKED", "Bloqueados", data.summary.blocked],
      ] as const)
    : [];

  return (
    <div className="min-w-0 space-y-4">
      <PageHeader title="Usuários" description="Contas cadastradas e seus acessos." />

      {query.isLoading ? (
        <LoadingState rows={5} label="Carregando usuários" />
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : !data ? (
        <LoadingState rows={5} label="Carregando usuários" />
      ) : (
        <>
          <div
            role="group"
            aria-label="Situação da conta"
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
          >
            {statusChips.map(([value, label, count]) => (
              <Chip
                key={label}
                active={search.status === value}
                onClick={() => setSearch({ status: value })}
              >
                {label} · {count}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <UserFilters
              values={search}
              providers={data.availableProviders}
              onChange={(patch) => setSearch(patch)}
              onClear={clearFilters}
            />
            <label className="ml-auto flex items-center gap-2 text-xs text-text-secondary">
              <span className="sr-only sm:not-sr-only">Ordenar</span>
              <select
                className="h-10 rounded-lg border border-border bg-surface px-2 text-sm text-text-primary"
                aria-label="Ordenar usuários"
                value={search.sort ?? "CREATED_DESC"}
                onChange={(event) => setSearch({ sort: event.target.value as Search["sort"] })}
              >
                {sortOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filterCount > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
              {search.role ? <span>{accessRoleLabel[search.role]}</span> : null}
              {search.provider ? <span>· {providerLabel[search.provider]}</span> : null}
              {search.created ? <span>· Cadastro filtrado</span> : null}
              {search.access ? <span>· Acesso filtrado</span> : null}
              <Button variant="link" size="sm" className="h-auto p-0" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </div>
          ) : null}

          {data.items.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum usuário encontrado"
              description="Revise os filtros selecionados."
            />
          ) : (
            <ul className="surface-card divide-y divide-border overflow-hidden">
              {data.items.map((item) => (
                <UserRow key={item.id} item={item} currentUserId={user.id} onAction={setDialog} />
              ))}
            </ul>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-3 text-sm text-text-secondary">
            <span>{data.total} usuário(s)</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-10"
                disabled={page <= 1}
                onClick={() => setSearch({ page: page - 1 })}
              >
                <ChevronLeft aria-hidden />
                Anterior
              </Button>
              <span aria-live="polite">
                {page} de {Math.max(1, Math.ceil(data.total / pageSize))}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-10"
                disabled={page * pageSize >= data.total}
                onClick={() => setSearch({ page: page + 1 })}
              >
                Próxima
                <ChevronRight aria-hidden />
              </Button>
            </div>
          </footer>
        </>
      )}

      <UserDialogs dialog={dialog} currentUserId={user.id} onClose={() => setDialog(null)} />
    </div>
  );
}
