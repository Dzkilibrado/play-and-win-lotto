import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, SlidersHorizontal, Users } from "lucide-react";
import { z } from "zod";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/StateViews";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter,
  DrawerHeader, DrawerTitle, DrawerTrigger,
} from "@/components/ui/drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { appConfig } from "@/config/app.config";
import { listAdminUsers } from "@/lib/admin/users.functions";
import { privateQueryKeys } from "@/lib/query/privateQueryKeys";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  page: z.coerce.number().int().positive().optional().catch(undefined),
  status: z.enum(["ACTIVE", "PENDING", "BLOCKED"]).optional().catch(undefined),
  role: z.enum(["USER", "ADMIN"]).optional().catch(undefined),
  provider: z.enum(["email", "google"]).optional().catch(undefined),
  created: z.enum(["TODAY", "7D", "30D", "90D"]).optional().catch(undefined),
  access: z.enum(["TODAY", "7D", "30D", "STALE", "NEVER"]).optional().catch(undefined),
  sort: z.enum(["CREATED_DESC", "CREATED_ASC", "ACCESS_DESC", "NAME_ASC", "NAME_DESC"]).optional().catch(undefined),
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
  head: () => ({ meta: [{ title: `Usuários — ${appConfig.name}` }] }),
  component: AdminUsersPage,
});

const statusLabel = { ACTIVE: "Ativo", PENDING: "Pendente", BLOCKED: "Bloqueado" } as const;
const providerLabel: Record<string, string> = { email: "E-mail/Senha", google: "Google" };
const pageSize = 20;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function formatAccess(value: string | null) {
  if (!value) return "Nunca acessou";
  const date = new Date(value);
  const now = new Date();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
  const current = day.format(now);
  const target = day.format(date);
  if (target === current) return `Hoje, ${time}`;
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (target === day.format(yesterday)) return `Ontem, ${time}`;
  return formatDate(value);
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  const tones = { neutral: "bg-surface-secondary text-text-primary", success: "bg-success-soft text-success", warning: "bg-warning-soft text-warning", danger: "bg-danger-soft text-danger", info: "bg-info-soft text-info" };
  return <span className={cn("inline-flex rounded-full px-2 py-1 text-[11px] font-semibold", tones[tone])}>{children}</span>;
}

function UserBadges({ role, status }: { role: "USER" | "ADMIN"; status: keyof typeof statusLabel }) {
  return <div className="flex flex-wrap gap-1.5"><Badge tone={role === "ADMIN" ? "info" : "neutral"}>{role}</Badge><Badge tone={status === "ACTIVE" ? "success" : status === "BLOCKED" ? "danger" : "warning"}>{statusLabel[status]}</Badge></div>;
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="block min-w-0 space-y-1.5 text-sm"><span className="text-text-secondary">{label}</span><select className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary" value={value} onChange={(event) => onChange(event.target.value)}>{children}</select></label>;
}

function AdminUsersPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { user } = Route.useRouteContext();
  const page = search.page ?? 1;
  const filters = { page, pageSize, status: search.status ?? null, role: search.role ?? null, provider: search.provider ?? null, createdPeriod: search.created ?? null, accessPeriod: search.access ?? null, sort: search.sort ?? "CREATED_DESC" as const };
  const query = useQuery({ queryKey: privateQueryKeys.adminUsers(user.id, filters), queryFn: () => listAdminUsers({ data: filters }), staleTime: 30_000 });
  const data = query.data;
  const setSearch = (patch: Partial<Search>) => navigate({ search: (previous) => ({ ...previous, ...patch, page: patch.page ?? undefined }) });
  const activeCount = [search.status, search.role, search.provider, search.created, search.access].filter(Boolean).length;
  const clearFilters = () => navigate({ search: { sort: search.sort } });

  const filterFields = <div className="grid gap-4 sm:grid-cols-2">
    <SelectField label="Status" value={search.status ?? ""} onChange={(value) => setSearch({ status: value as Search["status"] || undefined })}><option value="">Todos</option><option value="ACTIVE">Ativo</option><option value="PENDING">Pendente de confirmação</option>{(query.data?.summary.blocked ?? 0) > 0 && <option value="BLOCKED">Bloqueado</option>}</SelectField>
    <SelectField label="Role" value={search.role ?? ""} onChange={(value) => setSearch({ role: value as Search["role"] || undefined })}><option value="">Todos</option><option value="USER">USER</option><option value="ADMIN">ADMIN</option></SelectField>
    <SelectField label="Método de acesso" value={search.provider ?? ""} onChange={(value) => setSearch({ provider: value as Search["provider"] || undefined })}><option value="">Todos</option>{query.data?.availableProviders.map((provider) => <option key={provider} value={provider}>{providerLabel[provider] ?? provider}</option>)}</SelectField>
    <SelectField label="Cadastro" value={search.created ?? ""} onChange={(value) => setSearch({ created: value as Search["created"] || undefined })}><option value="">Todos</option><option value="TODAY">Hoje</option><option value="7D">Últimos 7 dias</option><option value="30D">Últimos 30 dias</option><option value="90D">Últimos 90 dias</option></SelectField>
    <SelectField label="Último acesso" value={search.access ?? ""} onChange={(value) => setSearch({ access: value as Search["access"] || undefined })}><option value="">Todos</option><option value="TODAY">Hoje</option><option value="7D">Últimos 7 dias</option><option value="30D">Últimos 30 dias</option><option value="STALE">Sem acesso recente</option><option value="NEVER">Nunca acessou</option></SelectField>
  </div>;

  return <div className="min-w-0 space-y-4">
    <PageHeader title="Usuários" description="Consulta administrativa de contas cadastradas." />
    {query.isLoading ? <LoadingState rows={5} label="Carregando usuários" /> : query.isError ? <ErrorState onRetry={() => query.refetch()} /> : !data ? <LoadingState rows={5} label="Carregando usuários" /> : <>
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Indicadores de usuários">
        {[
          ["Total", data.summary.total, {}], ["Ativos", data.summary.active, { status: "ACTIVE" }], ["USER", data.summary.users, { role: "USER" }], ["ADMIN", data.summary.admins, { role: "ADMIN" }],
        ].map(([label, count, patch]) => <button key={String(label)} type="button" onClick={() => setSearch(patch as Partial<Search>)} className="surface-card tappable min-h-16 p-3 text-left hover:border-primary"><span className="block text-xs text-text-secondary">{label as string}</span><strong className="font-display text-xl text-text-primary">{count as number}</strong></button>)}
      </section>

      <section className="surface-card space-y-3 p-3">
        <div className="flex min-w-0 flex-wrap items-end gap-2">
          <div className="hidden flex-1 lg:block">{filterFields}</div>
          <Drawer><DrawerTrigger asChild><Button variant="outline" className="lg:hidden"><SlidersHorizontal aria-hidden />Filtros{activeCount ? ` (${activeCount})` : ""}</Button></DrawerTrigger><DrawerContent className="max-h-[90vh]"><DrawerHeader><DrawerTitle>Filtrar usuários</DrawerTitle><DrawerDescription>Selecione os critérios da listagem.</DrawerDescription></DrawerHeader><div className="overflow-y-auto px-4">{filterFields}</div><DrawerFooter>{activeCount > 0 && <Button variant="ghost" onClick={clearFilters}>Limpar filtros</Button>}<DrawerClose asChild><Button>Ver resultados</Button></DrawerClose></DrawerFooter></DrawerContent></Drawer>
          <div className="ml-auto w-full sm:w-64"><SelectField label="Ordenar" value={search.sort ?? "CREATED_DESC"} onChange={(value) => setSearch({ sort: value as Search["sort"] })}><option value="CREATED_DESC">Cadastro mais recente</option><option value="CREATED_ASC">Cadastro mais antigo</option><option value="ACCESS_DESC">Último acesso mais recente</option><option value="NAME_ASC">Nome A–Z</option><option value="NAME_DESC">Nome Z–A</option></SelectField></div>
        </div>
        {activeCount > 0 && <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary"><span>{activeCount} filtro(s) ativo(s)</span><Button variant="link" size="sm" onClick={clearFilters}>Limpar filtros</Button></div>}
      </section>

      {query.data.items.length === 0 ? <EmptyState icon={Users} title="Nenhum usuário encontrado" description="Revise os filtros selecionados." /> : <>
        <div className="space-y-2 md:hidden">
          {query.data.items.map((item, index) => <article key={`${item.email}-${index}`} className="surface-card min-w-0 space-y-3 p-4"><div className="min-w-0"><h2 className="truncate font-display text-sm font-semibold">{item.name}</h2><p className="truncate text-xs text-text-secondary">{item.email}</p></div><UserBadges role={item.role} status={item.status} /><dl className="grid grid-cols-2 gap-3 text-xs"><div><dt className="text-text-secondary">Acesso</dt><dd>{item.providers.map((p) => providerLabel[p] ?? p).join(" + ") || "Não informado"}</dd></div><div><dt className="text-text-secondary">Cadastro</dt><dd>{formatDate(item.createdAt)}</dd></div><div className="col-span-2"><dt className="text-text-secondary">Último acesso</dt><dd>{formatAccess(item.lastAccessAt)}</dd></div></dl></article>)}
        </div>
        <div className="surface-card hidden overflow-hidden md:block"><Table><TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>E-mail</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Acesso</TableHead><TableHead>Cadastro</TableHead><TableHead>Último acesso</TableHead></TableRow></TableHeader><TableBody>{query.data.items.map((item, index) => <TableRow key={`${item.email}-${index}`}><TableCell className="max-w-40 truncate font-medium">{item.name}</TableCell><TableCell>{item.email}</TableCell><TableCell><Badge tone={item.role === "ADMIN" ? "info" : "neutral"}>{item.role}</Badge></TableCell><TableCell><Badge tone={item.status === "ACTIVE" ? "success" : item.status === "BLOCKED" ? "danger" : "warning"}>{statusLabel[item.status]}</Badge></TableCell><TableCell>{item.providers.map((p) => providerLabel[p] ?? p).join(" + ") || "Não informado"}</TableCell><TableCell>{formatDate(item.createdAt)}</TableCell><TableCell>{formatAccess(item.lastAccessAt)}</TableCell></TableRow>)}</TableBody></Table></div>
      </>}
      <footer className="flex flex-wrap items-center justify-between gap-3 text-sm text-text-secondary"><span>{query.data.total} usuário(s)</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setSearch({ page: page - 1 })}><ChevronLeft aria-hidden />Anterior</Button><span aria-live="polite">Página {page} de {Math.max(1, Math.ceil(query.data.total / pageSize))}</span><Button variant="outline" size="sm" disabled={page * pageSize >= query.data.total} onClick={() => setSearch({ page: page + 1 })}>Próxima<ChevronRight aria-hidden /></Button></div></footer>
    </>}
  </div>;
}