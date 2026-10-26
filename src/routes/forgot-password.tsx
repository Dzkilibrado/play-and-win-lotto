import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { appConfig } from "@/config/app.config";
import { supabase } from "@/integrations/supabase/client";
import { RECOVERY_REDIRECT, RECOVERY_NEUTRAL_MESSAGE, RECOVERY_WAIT_MESSAGE, requestRecovery } from "@/lib/auth/recovery";

export const Route = createFileRoute("/forgot-password")({ ssr: false, head: () => ({ meta: [{ title: `Recuperar acesso | ${appConfig.name}` }, { name: "description", content: "Receba por e-mail as instruções seguras para recuperar seu acesso." }, { property: "og:title", content: `Recuperar acesso | ${appConfig.name}` }, { property: "og:description", content: "Recuperação segura de acesso por e-mail." }, { property: "og:type", content: "website" }, { property: "og:url", content: `${appConfig.canonicalOrigin}/forgot-password` }, { name: "twitter:card", content: "summary" }], links: [{ rel: "canonical", href: `${appConfig.canonicalOrigin}/forgot-password` }] }), component: ForgotPasswordPage });

function ForgotPasswordPage() {
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false); const [loading, setLoading] = useState(false);
  const [error, setError] = useState(""); const [nextRequestAt, setNextRequestAt] = useState(0);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (loading) return;
    if (Date.now() < nextRequestAt) { setError(RECOVERY_WAIT_MESSAGE); return; }
    setLoading(true); setError("");
    const result = await requestRecovery(() => supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: RECOVERY_REDIRECT }));
    setLoading(false); setNextRequestAt(Date.now() + 60_000);
    if (result.accepted) setSent(true); else setError(result.message);
  }
  return <AuthLayout title="Recuperar acesso" description="A recuperação é feita somente por e-mail, usando um link seguro e temporário.">
    {sent ? <div className="space-y-4"><p className="text-sm text-text-secondary" role="status">{RECOVERY_NEUTRAL_MESSAGE}</p><Button variant="outline" className="h-11 w-full" onClick={() => { setSent(false); setError(Date.now() < nextRequestAt ? RECOVERY_WAIT_MESSAGE : ""); }}>Solicitar novo e-mail</Button></div> : <form onSubmit={submit} className="space-y-4"><div className="space-y-1.5"><Label htmlFor="recovery-email">E-mail</Label><Input id="recovery-email" type="email" autoComplete="email" required maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} className="h-11" /></div>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button className="h-11 w-full" disabled={loading}>{loading ? "Enviando…" : "Enviar instruções"}</Button></form>}
    <p className="mt-6 text-center text-sm"><Link to="/login" className="text-primary hover:underline">Voltar para entrar</Link></p>
  </AuthLayout>;
}