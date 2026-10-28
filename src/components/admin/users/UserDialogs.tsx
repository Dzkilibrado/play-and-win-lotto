import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import type { AdminUser } from "@/components/admin/users/UserRow";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  accessRoleLabel,
  accessRoles,
  roleChangeReasons,
  type AccessRole,
  type RoleChangeReason,
} from "@/config/accessModules";
import { changeAdminUserRole, deleteAdminUser } from "@/lib/admin/access.functions";
import { changeAdminUserAccess, sendAdminPasswordRecovery } from "@/lib/admin/users.functions";

export type UserDialog =
  | { kind: "role" | "block" | "delete" | "recovery"; item: AdminUser }
  | null;

function Field({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0 space-y-1.5 text-sm">
      <span className="text-text-secondary">{label}</span>
      <select
        className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function useRefreshUsers(currentUserId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["admin", currentUserId, "users"] });
}

const errorText = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

function RoleDialog({ item, currentUserId, onClose }: Props) {
  const refresh = useRefreshUsers(currentUserId);
  const [role, setRole] = useState<AccessRole | "">("");
  const [reason, setReason] = useState<RoleChangeReason | "">("");
  const [details, setDetails] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      changeAdminUserRole({
        data: {
          targetUserId: item.id,
          role: role as AccessRole,
          reason: reason || null,
          reasonDetails: details.trim() || null,
        },
      }),
    onSuccess: async () => {
      await refresh();
      toast.success("Tipo de acesso alterado.");
      onClose();
    },
    onError: (error) => toast.error(errorText(error, "Não foi possível alterar o tipo de acesso.")),
  });

  return (
    <DialogShell
      title="Alterar tipo de acesso"
      description={`Tipo atual: ${accessRoleLabel[item.role]}. A mudança fica registrada na auditoria.`}
      onClose={onClose}
      pending={mutation.isPending}
      footer={
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !role || (reason === "OTHER" && !details.trim())}
        >
          {mutation.isPending ? "Salvando…" : "Confirmar"}
        </Button>
      }
    >
      <Field label="Novo tipo de acesso" value={role} onChange={(v) => setRole(v as AccessRole | "")}>
        <option value="">Escolha uma opção</option>
        {accessRoles
          .filter((value) => value !== item.role)
          .map((value) => (
            <option key={value} value={value}>
              {accessRoleLabel[value]}
            </option>
          ))}
      </Field>
      <Field label="Motivo (opcional)" value={reason} onChange={(v) => setReason(v as RoleChangeReason | "")}>
        <option value="">Não informar</option>
        {roleChangeReasons.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Field>
      {reason === "OTHER" ? (
        <DetailsInput value={details} onChange={setDetails} />
      ) : null}
    </DialogShell>
  );
}

function BlockDialog({ item, currentUserId, onClose }: Props) {
  const refresh = useRefreshUsers(currentUserId);
  const blocking = item.status === "ACTIVE";
  const [reason, setReason] = useState<"" | "ADMIN_REQUEST" | "SECURITY" | "MISUSE" | "OTHER">("");
  const [details, setDetails] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      changeAdminUserAccess({
        data: {
          targetUserId: item.id,
          action: blocking ? "BLOCK" : "UNBLOCK",
          reason: reason || null,
          reasonDetails: details.trim() || null,
        },
      }),
    onSuccess: async () => {
      await refresh();
      toast.success(blocking ? "Acesso bloqueado." : "Acesso restaurado.");
      onClose();
    },
    onError: (error) => toast.error(errorText(error, "Não foi possível atualizar o acesso.")),
  });

  return (
    <DialogShell
      title={blocking ? "Bloquear acesso deste usuário?" : "Restaurar acesso deste usuário?"}
      description={
        blocking
          ? "O usuário não poderá entrar enquanto estiver bloqueado. Os dados e registros são preservados."
          : "O usuário poderá entrar novamente com as credenciais já existentes."
      }
      onClose={onClose}
      pending={mutation.isPending}
      footer={
        <Button
          variant={blocking ? "destructive" : "default"}
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || (reason === "OTHER" && !details.trim())}
        >
          {mutation.isPending ? "Salvando…" : blocking ? "Bloquear acesso" : "Desbloquear"}
        </Button>
      }
    >
      <Field label="Motivo (opcional)" value={reason} onChange={(v) => setReason(v as typeof reason)}>
        <option value="">Não informar</option>
        <option value="ADMIN_REQUEST">Solicitação do administrador</option>
        <option value="SECURITY">Segurança</option>
        <option value="MISUSE">Uso indevido</option>
        <option value="OTHER">Outro</option>
      </Field>
      {reason === "OTHER" ? <DetailsInput value={details} onChange={setDetails} /> : null}
    </DialogShell>
  );
}

const deleteReasons = [
  { value: "TEST_ACCOUNT", label: "Conta de teste" },
  { value: "OWNER_REQUEST", label: "Pedido do titular (LGPD)" },
  { value: "OTHER", label: "Outro" },
] as const;

function DeleteDialog({ item, currentUserId, onClose }: Props) {
  const refresh = useRefreshUsers(currentUserId);
  const [reason, setReason] = useState<"" | (typeof deleteReasons)[number]["value"]>("");
  const [details, setDetails] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      deleteAdminUser({
        data: {
          targetUserId: item.id,
          reason: reason as "TEST_ACCOUNT" | "OWNER_REQUEST" | "OTHER",
          reasonDetails: details.trim() || null,
          confirmation: "EXCLUIR",
        },
      }),
    onSuccess: async () => {
      await refresh();
      toast.success("Conta excluída.");
      onClose();
    },
    onError: (error) => toast.error(errorText(error, "Não foi possível excluir a conta.")),
  });
  const ready =
    Boolean(reason) &&
    confirmation.trim().toUpperCase() === "EXCLUIR" &&
    (reason !== "OTHER" || details.trim().length > 0);

  return (
    <DialogShell
      title="Excluir esta conta?"
      description="A conta e os dados ligados a ela (jogos e bolões que ela criou) são apagados de vez. Não dá para desfazer. Para uma conta de uso real, prefira bloquear o acesso."
      onClose={onClose}
      pending={mutation.isPending}
      footer={
        <Button variant="destructive" onClick={() => mutation.mutate()} disabled={!ready || mutation.isPending}>
          {mutation.isPending ? "Excluindo…" : "Excluir definitivamente"}
        </Button>
      }
    >
      <Field label="Motivo" value={reason} onChange={(v) => setReason(v as typeof reason)}>
        <option value="">Escolha uma opção</option>
        {deleteReasons.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Field>
      {reason === "OTHER" ? <DetailsInput value={details} onChange={setDetails} /> : null}
      <label className="block space-y-1.5 text-sm">
        <span className="text-text-secondary">
          Para confirmar, digite <strong className="text-text-primary">EXCLUIR</strong>
        </span>
        <Input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
        />
      </label>
    </DialogShell>
  );
}

function RecoveryDialog({ item, onClose }: Props) {
  const mutation = useMutation({
    mutationFn: () => sendAdminPasswordRecovery({ data: { targetUserId: item.id } }),
    onSuccess: () => {
      toast.success("Instruções de redefinição de senha enviadas.");
      onClose();
    },
    onError: (error) => toast.error(errorText(error, "Não foi possível enviar as instruções.")),
  });
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Enviar instruções de redefinição de senha?"
      description="O usuário receberá um link seguro por e-mail e escolherá a própria senha. O status de acesso não muda."
      confirmLabel="Enviar"
      loadingLabel="Enviando…"
      loading={mutation.isPending}
      onConfirm={() => mutation.mutate()}
    />
  );
}

interface Props {
  item: AdminUser;
  currentUserId: string;
  onClose: () => void;
}

function DetailsInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="text-text-secondary">Descrição curta</span>
      <Input value={value} onChange={(event) => onChange(event.target.value)} maxLength={160} required />
    </label>
  );
}

function DialogShell({
  title,
  description,
  onClose,
  pending,
  footer,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  pending: boolean;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">{children}</div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UserDialogs({
  dialog,
  currentUserId,
  onClose,
}: {
  dialog: UserDialog;
  currentUserId: string;
  onClose: () => void;
}) {
  if (!dialog) return null;
  const props = { item: dialog.item, currentUserId, onClose, key: `${dialog.kind}-${dialog.item.id}` };
  if (dialog.kind === "role") return <RoleDialog {...props} />;
  if (dialog.kind === "block") return <BlockDialog {...props} />;
  if (dialog.kind === "delete") return <DeleteDialog {...props} />;
  return <RecoveryDialog {...props} />;
}
