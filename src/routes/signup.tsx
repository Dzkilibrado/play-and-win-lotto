import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { appConfig } from "@/config/app.config";
import { supabase } from "@/integrations/supabase/client";
import { formatBrazilianPhone, maximumBirthDate, signupSchema } from "@/lib/auth/identity";

type LegalVersion = { id: string; document_type: string; version: string };
export const Route = createFileRoute("/signup")({ ssr: false, head: () => ({ meta: [{ title: `Criar conta | ${appConfig.name}` }, { name: "description", content: "Crie sua conta no Gestor da Sorte." }, { property: "og:title", content: `Criar conta | ${appConfig.name}` }, { property: "og:description", content: "Organize jogos e bolões em uma conta segura." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }], links: [{ rel: "canonical", href: `${appConfig.canonicalOrigin}/signup` }] }), component: SignupPage });

function SignupPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: "", birthDate: "", phone: "", email: "", password: "", confirmPassword: "" });
  const [accepted, setAccepted] = useState(false); const [versions, setVersions] = useState<LegalVersion[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const [created, setCreated] = useState(false);
  useEffect(() => { supabase.from("legal_document_versions").select("id, document_type, version").eq("is_active", true).then(({ data }) => setVersions((data ?? []) as LegalVersion[])); }, []);
  const update = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) => setValues((current) => ({ ...current, [key]: event.target.value }));
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); const parsed = signupSchema.safeParse({ ...values, accepted });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Confira os dados informados"); return; }
    if (versions.length < 2) { setError("Não foi possível carregar os documentos vigentes. Tente novamente."); return; }
    setLoading(true);
    const { data, error: signupError } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password, options: { emailRedirectTo: `${window.location.origin}/login`, data: { display_name: parsed.data.name, birth_date: parsed.data.birthDate, phone: parsed.data.phone, accepted_document_ids: versions.map((item) => item.id) } } });
    setLoading(false); if (signupError) { setError(signupError.message.includes("18") ? signupError.message : "Não foi possível criar a conta. Confira os dados e tente novamente."); return; }
    if (data.session) navigate({ to: "/dashboard", replace: true }); else setCreated(true);
  }
  if (created) return <AuthLayout title="Confirme seu e-mail" description="Enviamos uma mensagem para concluir seu cadastro."><div className="surface-card space-y-3 p-4 text-sm text-text-secondary"><p>Abra o link recebido no e-mail para confirmar sua conta. Depois, você poderá entrar normalmente.</p><Button asChild className="w-full"><Link to="/login">Ir para entrar</Link></Button></div></AuthLayout>;
  return <AuthLayout title="Criar conta" description="Seus jogos e bolões em um só lugar."><form onSubmit={submit} className="space-y-4">
    <Field label="Nome completo" id="name"><Input id="name" autoComplete="name" required maxLength={120} value={values.name} onChange={update("name")} className="h-11" /></Field>
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2"><Field label="Data de nascimento" id="birthDate"><Input id="birthDate" type="date" autoComplete="bday" max={maximumBirthDate()} required value={values.birthDate} onChange={update("birthDate")} className="h-11" /></Field><Field label="Telefone" id="phone"><Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(27) 99202-0234" required value={values.phone} onChange={(event) => setValues((current) => ({ ...current, phone: formatBrazilianPhone(event.target.value) }))} className="h-11" /></Field></div>
    <Field label="E-mail" id="signup-email"><Input id="signup-email" type="email" autoComplete="email" required maxLength={255} value={values.email} onChange={update("email")} className="h-11" /></Field>
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2"><Field label="Senha" id="signup-password"><Input id="signup-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={values.password} onChange={update("password")} className="h-11" /></Field><Field label="Confirmar senha" id="confirmPassword"><Input id="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={values.confirmPassword} onChange={update("confirmPassword")} className="h-11" /></Field></div>
    <label className="flex cursor-pointer items-start gap-3 text-sm text-text-secondary"><Checkbox checked={accepted} onCheckedChange={(value) => setAccepted(value === true)} className="mt-0.5 size-5" /><span>Li e aceito os <Link to="/terms" target="_blank" className="font-medium text-primary underline">Termos de Uso</Link> e a <Link to="/privacy" target="_blank" className="font-medium text-primary underline">Política de Privacidade</Link>.</span></label>
    {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}<Button className="h-11 w-full" disabled={loading}>{loading ? "Criando conta…" : "Criar conta"}</Button>
  </form><p className="mt-6 text-center text-sm text-text-secondary">Já possui uma conta? <Link to="/login" className="font-semibold text-primary hover:underline">Entrar</Link></p></AuthLayout>;
}
function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) { return <div className="min-w-0 space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>; }
