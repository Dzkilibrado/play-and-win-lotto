import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { appConfig } from "@/config/app.config";
import { supabase } from "@/integrations/supabase/client";
import { shouldAuthenticatePassword } from "@/lib/auth/loginFlow";

export const Route = createFileRoute("/login")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: `Entrar | ${appConfig.name}` },
      { name: "description", content: "Acesse sua conta com segurança no Gestor da Sorte." },
      { property: "og:title", content: `Entrar | ${appConfig.name}` },
      { property: "og:description", content: "Acesse sua conta com segurança no Gestor da Sorte." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${appConfig.canonicalOrigin}/login` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${appConfig.canonicalOrigin}/login` }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const explicitSubmit = useRef(false);

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    if (!shouldAuthenticatePassword(explicitSubmit.current)) return;
    explicitSubmit.current = false;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) { toast.error("E-mail ou senha incorretos"); return; }
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleGoogle() {
    setLoading(true);
    const { lovable } = await import("@/integrations/lovable/index");
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/login` });
    if (result.error) { setLoading(false); toast.error("Não foi possível entrar com o Google"); return; }
    if (!result.redirected) navigate({ to: "/dashboard", replace: true });
  }

  return <AuthLayout title="Entrar" description={appConfig.tagline}>
    <form onSubmit={handleSignIn} onKeyDown={(event) => { if (event.key === "Enter") explicitSubmit.current = true; }} className="space-y-4">
      <div className="space-y-1.5"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" autoComplete="email" required maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} className="h-11" /></div>
      <div className="space-y-1.5"><div className="flex items-center justify-between gap-3"><Label htmlFor="password">Senha</Label><Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">Esqueci minha senha</Link></div><Input id="password" type="password" autoComplete="current-password" required maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} className="h-11" /></div>
      <Button type="submit" className="h-11 w-full" disabled={loading} onClick={() => { explicitSubmit.current = true; }}>{loading ? "Entrando…" : "Entrar"}</Button>
    </form>
    <div className="my-5 flex items-center gap-3 text-xs text-text-secondary"><span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" /></div>
    <Button variant="outline" className="h-11 w-full" onClick={handleGoogle} disabled={loading}>Continuar com Google</Button>
    <p className="mt-6 text-center text-sm text-text-secondary">Não possui uma conta? <Link to="/signup" className="font-semibold text-primary hover:underline">Criar conta</Link></p>
  </AuthLayout>;
}