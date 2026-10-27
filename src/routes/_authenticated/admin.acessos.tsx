import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminSection } from "@/components/admin/AdminSection";
import { ErrorState, LoadingState } from "@/components/common/StateViews";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  accessModules,
  accessRoleDescription,
  accessRoleLabel,
  accessRoles,
  permissionActionLabel,
  permissionActions,
} from "@/config/accessModules";
import { appConfig } from "@/config/app.config";
import { useSession } from "@/hooks/useAuth";
import { getSupportPermissions, saveSupportPermissions } from "@/lib/admin/access.functions";
import {
  canAct,
  countGranted,
  normalizeMatrix,
  sameMatrix,
  setPermission,
  type PermissionMatrix,
} from "@/lib/admin/permissions";

export const Route = createFileRoute("/_authenticated/admin/acessos")({
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/dashboard", replace: true });
  },
  head: () => ({
    meta: [
      { title: `Tipos de acesso — ${appConfig.name}` },
      {
        name: "description",
        content: "O que cada tipo de acesso pode ver e fazer na Administração.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const queryKey = ["admin", user.id, "support-permissions"];
  const query = useQuery({ queryKey, queryFn: () => getSupportPermissions(), staleTime: 30_000 });
  const [draft, setDraft] = useState<PermissionMatrix>(() => normalizeMatrix([]));

  useEffect(() => {
    if (query.data) setDraft(query.data);
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => saveSupportPermissions({ data: { permissions: draft } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast.success("Permissões do Suporte salvas.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar."),
  });

  const dirty = query.data ? !sameMatrix(draft, query.data) : false;

  return (
    <AdminSection
      title="Tipos de acesso"
      description="Defina o que o Suporte pode ver e fazer. O Administrador tem acesso total."
    >
      <section aria-label="Tipos de acesso existentes" className="grid gap-2 sm:grid-cols-3">
        {accessRoles.map((role) => (
          <div key={role} className="surface-card space-y-1 p-3">
            <h2 className="font-display text-sm font-semibold text-text-primary">
              {accessRoleLabel[role]}
            </h2>
            <p className="text-xs text-text-secondary">{accessRoleDescription[role]}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="perm-suporte" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="perm-suporte" className="font-display text-base font-semibold text-text-primary">
            Permissões do Suporte
          </h2>
          {query.data ? (
            <span className="text-xs text-text-secondary" aria-live="polite">
              {countGranted(draft)} permissão(ões) liberada(s)
            </span>
          ) : null}
        </div>

        {query.isLoading ? (
          <LoadingState rows={4} label="Carregando permissões" />
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : (
          <>
            <ul className="space-y-2">
              {accessModules.map((module) => (
                <li key={module.key} className="surface-card space-y-3 p-4">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-text-primary">
                      {module.label}
                    </h3>
                    <p className="text-xs text-text-secondary">{module.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {permissionActions.map((action) => {
                      const id = `perm-${module.key}-${action}`;
                      return (
                        <label
                          key={action}
                          htmlFor={id}
                          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm text-text-primary"
                        >
                          <Checkbox
                            id={id}
                            checked={canAct(draft, module.key, action)}
                            onCheckedChange={(value) =>
                              setDraft((current) =>
                                setPermission(current, module.key, action, value === true),
                              )
                            }
                          />
                          {permissionActionLabel[action]}
                        </label>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-xs text-text-secondary">
              Criar, editar e excluir exigem a permissão de ver. As mudanças ficam registradas na
              auditoria.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                className="h-12"
                disabled={!dirty || save.isPending}
                onClick={() => save.mutate()}
              >
                {save.isPending ? "Salvando…" : "Salvar permissões"}
              </Button>
              <Button
                className="h-12"
                variant="outline"
                disabled={!dirty || save.isPending}
                onClick={() => query.data && setDraft(query.data)}
              >
                Desfazer alterações
              </Button>
            </div>
          </>
        )}
      </section>
    </AdminSection>
  );
}
