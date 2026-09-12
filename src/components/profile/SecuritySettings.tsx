import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

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
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  changePasswordSchema,
  currentPasswordError,
  getAccountMethods,
  passwordChangeError,
} from "@/lib/auth/password-security";

type PasswordValues = {
  currentPassword: string;
  newPassword: string;
  confirmation: string;
};

const emptyValues: PasswordValues = { currentPassword: "", newPassword: "", confirmation: "" };

export function SecuritySettings({ sessionUser }: { sessionUser: User | null }) {
  const [verifiedUser, setVerifiedUser] = useState<User | null>(null);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setVerifiedUser(data.user);
      setLoadingMethods(false);
    });
    return () => { active = false; };
  }, [sessionUser?.id]);

  const methods = getAccountMethods(verifiedUser);
  const methodLabel = methods.labels.length > 0 ? methods.labels.join(" + ") : "Não identificado";

  return (
    <section className="surface-card space-y-4 p-4" aria-labelledby="account-security-title">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden="true">
          <ShieldCheck className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="account-security-title" className="font-display text-base font-semibold text-text-primary">Segurança da conta</h2>
          <p className="mt-1 text-sm text-text-secondary">Gerencie com segurança seu método de acesso.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">Método de acesso</p>
          <p className="mt-1 text-sm text-text-secondary" aria-live="polite">
            {loadingMethods ? "Verificando…" : methodLabel}
          </p>
          {!loadingMethods && methods.hasGoogle && !methods.hasPassword ? (
            <p className="mt-2 text-sm text-text-secondary">Você utiliza sua Conta Google para acessar o Gestor da Sorte.</p>
          ) : null}
        </div>

        {!loadingMethods && methods.hasPassword ? (
          <Button type="button" variant="outline" className="h-11 w-full shrink-0 sm:w-auto" onClick={() => setOpen(true)}>
            <KeyRound aria-hidden="true" /> Alterar senha
          </Button>
        ) : null}
      </div>

      {methods.hasPassword ? <ChangePasswordDialog user={verifiedUser} open={open} onOpenChange={setOpen} /> : null}
    </section>
  );
}

function ChangePasswordDialog({ user, open, onOpenChange }: { user: User | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [values, setValues] = useState<PasswordValues>(emptyValues);
  const [visible, setVisible] = useState<Record<keyof PasswordValues, boolean>>({ currentPassword: false, newPassword: false, confirmation: false });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setValues(emptyValues);
    setVisible({ currentPassword: false, newPassword: false, confirmation: false });
    setError("");
  }

  function changeOpen(nextOpen: boolean) {
    if (submitting) return;
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  const parsed = changePasswordSchema.safeParse(values);
  const confirmationMismatch = values.confirmation.length > 0 && values.newPassword !== values.confirmation;
  const newPasswordTooShort = values.newPassword.length > 0 && values.newPassword.length < 8;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const validated = changePasswordSchema.safeParse(values);
    if (!validated.success) {
      setError(validated.error.issues[0]?.message ?? "Confira as senhas informadas.");
      return;
    }
    if (!user?.email) {
      setError("Não foi possível confirmar sua conta. Entre novamente e tente de novo.");
      return;
    }

    setSubmitting(true);
    const { error: reauthenticationError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: validated.data.currentPassword,
    });
    if (reauthenticationError) {
      setSubmitting(false);
      setError(currentPasswordError(reauthenticationError));
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: validated.data.newPassword });
    if (updateError) {
      setSubmitting(false);
      setError(passwordChangeError(updateError));
      return;
    }

    await supabase.rpc("record_password_changed");
    setSubmitting(false);
    reset();
    onOpenChange(false);
    toast.success("Senha alterada com sucesso.");
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar senha</DialogTitle>
          <DialogDescription>Confirme sua senha atual e escolha uma nova senha para sua conta.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <PasswordField id="current-password" label="Senha atual" autoComplete="current-password" value={values.currentPassword} visible={visible.currentPassword} onChange={(value) => setValues((current) => ({ ...current, currentPassword: value }))} onToggle={() => setVisible((current) => ({ ...current, currentPassword: !current.currentPassword }))} />
          <div className="space-y-2">
            <PasswordField id="new-password" label="Nova senha" autoComplete="new-password" value={values.newPassword} visible={visible.newPassword} onChange={(value) => setValues((current) => ({ ...current, newPassword: value }))} onToggle={() => setVisible((current) => ({ ...current, newPassword: !current.newPassword }))} />
            <p className={newPasswordTooShort ? "text-xs text-danger" : "text-xs text-text-secondary"}>Use de 8 a 72 caracteres.</p>
          </div>
          <PasswordField id="confirm-new-password" label="Confirmar nova senha" autoComplete="new-password" value={values.confirmation} visible={visible.confirmation} onChange={(value) => setValues((current) => ({ ...current, confirmation: value }))} onToggle={() => setVisible((current) => ({ ...current, confirmation: !current.confirmation }))} />
          {confirmationMismatch ? <p className="text-sm text-danger" role="alert">As novas senhas não coincidem.</p> : null}
          {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="h-11 w-full sm:w-auto" disabled={submitting} onClick={() => changeOpen(false)}>Cancelar</Button>
            <Button type="submit" className="h-11 w-full sm:w-auto" disabled={submitting || !parsed.success}>{submitting ? "Alterando…" : "Alterar senha"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordField({ id, label, autoComplete, value, visible, onChange, onToggle }: { id: string; label: string; autoComplete: "current-password" | "new-password"; value: string; visible: boolean; onChange: (value: string) => void; onToggle: () => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} type={visible ? "text" : "password"} autoComplete={autoComplete} required minLength={autoComplete === "new-password" ? 8 : 1} maxLength={72} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 pr-12" />
        <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 size-11" aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`} aria-pressed={visible} onClick={onToggle}>
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}