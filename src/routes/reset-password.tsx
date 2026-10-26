import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { appConfig } from "@/config/app.config";
import { supabase } from "@/integrations/supabase/client";
import { isRecoveryClaims, recoveryPasswordSchema, recoveryError, RECOVERY_INVALID_MESSAGE } from "@/lib/auth/recovery";

export const Route = createFileRoute("/reset-password")({ ssr: false, head: () => ({ meta: [{ title: `Nova senha | ${appConfig.name}` }, { name: "description", content: "Defina uma nova senha para sua conta." }, { property: "og:title", content: `Nova senha | ${appConfig.name}` }, { property: "og:description", content: "Redefinição segura de senha." }, { property: "og:type", content: "website" }, { name: "robots", content: "noindex" }, { name: "twitter:card", content: "summary" }] }), component: ResetPasswordPage });

function ResetPasswordPage() {
  const queryClient = useQueryClient();
  const [valid, setValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const [success, setSuccess] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    let active = true;
    // Initialization is awaited by getClaims; URL markers and session presence are not proof.
    void supabase.auth.getClaims().then(({ data, error: claimsError }) => {
      if (!active) return;
      setValid(!claimsError && isRecoveryClaims(data?.claims));
      window.history.replaceState(window.history.state, "", "/reset-password");
    }).catch(() => { if (active) setValid(false); });
    return () => { active = false; };
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!valid || submitting.current || success) return;
    setError(""); const parsed = recoveryPasswordSchema.safeParse({ password, confirmation });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Confira a nova senha."); return; }
    submitting.current = true; setLoading(true);
    try {
      const { data, error: claimsError } = await supabase.auth.getClaims();
      if (claimsError || !isRecoveryClaims(data?.claims)) { setValid(false); return; }
      const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (updateError) { const message = recoveryError(updateError); if (message === RECOVERY_INVALID_MESSAGE) setValid(false); else setError(message); return; }
      setPassword(""); setConfirmation("");
      const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
      if (signOutError) {
        await supabase.auth.signOut({ scope: "local" });
        setError("A senha foi alterada, mas não foi possível confirmar o encerramento de todas as sessões anteriores.");
      }
      await queryClient.cancelQueries(); queryClient.clear();
      setValid(false); setSuccess(true);
    } catch { setError("Não foi possível concluir a solicitação. Tente novamente em instantes."); }
    finally { submitting.current = false; setLoading(false); }
  }
  return <AuthLayout title="Redefinir senha" description="Escolha uma senha exclusiva para sua conta.">
    {success ? <div className="space-y-4"><p role="status" className="text-sm text-success">Senha alterada com sucesso.</p>{error && <p role="alert" className="text-sm text-warning">{error}</p>}<Button asChild className="h-11 w-full"><Link to="/login">Ir para o Login</Link></Button></div>
      : valid === null ? <p role="status" className="text-sm text-text-secondary">Validando link…</p>
      : !valid ? <div className="space-y-4"><p role="alert" className="text-sm text-text-secondary">{RECOVERY_INVALID_MESSAGE}</p><Button asChild className="h-11 w-full"><Link to="/forgot-password">Solicitar novo link</Link></Button></div>
      : <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5"><Label htmlFor="new-password">Nova senha</Label><Input id="new-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" /><p className="text-xs text-text-secondary">Use uma senha exclusiva. Os critérios de segurança da sua conta serão verificados ao salvar.</p></div>
        <div className="space-y-1.5"><Label htmlFor="confirm-password">Confirmar nova senha</Label><Input id="confirm-password" type="password" autoComplete="new-password" required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="h-11" /></div>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <Button className="h-11 w-full" disabled={loading}>{loading ? "Salvando…" : "Salvar nova senha"}</Button>
      </form>}
  </AuthLayout>;
}