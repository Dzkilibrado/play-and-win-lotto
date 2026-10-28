import { MoreVertical } from "lucide-react";

import {
  Badge,
  formatAccess,
  formatDate,
  roleTone,
  statusLabel,
  statusTone,
} from "@/components/admin/users/userUi";
import type { UserDialog } from "@/components/admin/users/UserDialogs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { accessRoleLabel } from "@/config/accessModules";
import type { AdminUsersResult } from "@/lib/admin/users.functions";
import { hasLocalPassword } from "@/lib/auth/recovery";

export type AdminUser = AdminUsersResult["items"][number];

export function UserRow({
  item,
  currentUserId,
  onAction,
}: {
  item: AdminUser;
  currentUserId: string;
  onAction: (dialog: UserDialog) => void;
}) {
  const isSelf = item.id === currentUserId;
  const protectedAccount = isSelf || item.isSystemOwner;
  const canChangeRole = item.status !== "PENDING" && !protectedAccount;
  const canBlock = item.status !== "PENDING" && !(protectedAccount && item.status === "ACTIVE");
  const canRecover = hasLocalPassword(item.providers);
  const canDelete = !protectedAccount;
  const deleteBlockedByRole = item.role !== "USER";
  const hasActions = canChangeRole || canBlock || canRecover || canDelete;

  return (
    <li className="flex items-center gap-3 px-3 py-3 sm:px-4">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-secondary font-display text-sm font-semibold text-text-primary"
      >
        {(item.name.trim()[0] ?? "?").toUpperCase()}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary">
          {item.name}
          {isSelf ? (
            <span className="ml-1.5 text-xs font-normal text-text-secondary">(você)</span>
          ) : null}
        </p>
        <p className="truncate text-xs text-text-secondary">{item.email}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge tone={roleTone(item.role)}>{accessRoleLabel[item.role]}</Badge>
          <Badge tone={statusTone(item.status)}>{statusLabel[item.status]}</Badge>
          {item.isSystemOwner ? <Badge tone="info">Responsável principal</Badge> : null}
        </div>
        <p className="mt-1 text-[11px] text-text-secondary">
          Último acesso: {formatAccess(item.lastAccessAt)} · Cadastro: {formatDate(item.createdAt)}
        </p>
      </div>

      {hasActions ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 shrink-0"
              aria-label={`Ações para ${item.name}`}
            >
              <MoreVertical className="size-5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {canChangeRole ? (
              <DropdownMenuItem
                className="min-h-11"
                onSelect={() => onAction({ kind: "role", item })}
              >
                Alterar tipo de acesso
              </DropdownMenuItem>
            ) : null}
            {canBlock ? (
              <DropdownMenuItem
                className="min-h-11"
                onSelect={() => onAction({ kind: "block", item })}
              >
                {item.status === "ACTIVE" ? "Bloquear acesso" : "Desbloquear acesso"}
              </DropdownMenuItem>
            ) : null}
            {canRecover ? (
              <DropdownMenuItem
                className="min-h-11"
                onSelect={() => onAction({ kind: "recovery", item })}
              >
                Enviar redefinição de senha
              </DropdownMenuItem>
            ) : null}
            {canDelete ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="min-h-11 text-danger focus:text-danger"
                  disabled={deleteBlockedByRole}
                  onSelect={() => onAction({ kind: "delete", item })}
                >
                  {deleteBlockedByRole ? "Excluir (mude o tipo antes)" : "Excluir conta"}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </li>
  );
}
