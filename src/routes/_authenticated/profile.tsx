import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LoadingState } from "@/components/common/StateViews";
import { PageHeader } from "@/components/layout/PageHeader";
import { SecuritySettings } from "@/components/profile/SecuritySettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { appConfig } from "@/config/app.config";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/useAuth";
import { formatBrazilianPhone, maximumBirthDate, profileSchema } from "@/lib/auth/identity";
import { completeProfile } from "@/lib/auth/profile.functions";

export const Route = createFileRoute("/_authenticated/profile")({ head: () => ({ meta: [{ title: `Perfil | ${appConfig.name}` }, { name: "description", content: "Consulte e atualize seus dados de conta." }, { property: "og:title", content: `Perfil | ${appConfig.name}` }, { property: "og:description", content: "Consulte e atualize seus dados de conta." }, { property: "og:type", content: "website" }, { name: "robots", content: "noindex" }, { name: "twitter:card", content: "summary" }] }), component: ProfilePage });

function ProfilePage() {
  const { user } = useSession(); const profile = useProfile(user); const save = useServerFn(completeProfile);
  const [name, setName] = useState(""); const [birthDate, setBirthDate] = useState(""); const [phone, setPhone] = useState(""); const [saving, setSaving] = useState(false);
  useEffect(() => { if (!profile.data) return; setName(profile.data.display_name ?? ""); setBirthDate(profile.data.birth_date ?? ""); setPhone(formatBrazilianPhone(profile.data.phone ?? "")); }, [profile.data]);
  async function submit(event: React.FormEvent) { event.preventDefault(); const { data: documents, error: documentsError } = await supabase.from("legal_document_versions").select("id").eq("is_active", true); if (documentsError) { toast.error("Não foi possível validar os documentos vigentes"); return; } const parsed = profileSchema.safeParse({ name, birthDate, phone, acceptedDocumentIds: (documents ?? []).map((item) => item.id) }); if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Confira seus dados"); return; } setSaving(true); try { await save({ data: { ...parsed.data, phone: parsed.data.phone ?? "" } }); await profile.refetch(); toast.success("Perfil atualizado"); } catch { toast.error("Não foi possível atualizar o perfil"); } finally { setSaving(false); } }
  return <div className="space-y-4"><PageHeader title="Perfil" description="Mantenha seus dados de conta atualizados." />{profile.isLoading ? <LoadingState rows={1} /> : <><form onSubmit={submit} className="surface-card grid gap-4 p-4 sm:grid-cols-2" aria-labelledby="personal-data-title"><div className="sm:col-span-2"><h2 id="personal-data-title" className="font-display text-base font-semibold text-text-primary">Dados pessoais</h2><p className="mt-1 text-sm text-text-secondary">Informações usadas na sua conta.</p></div><div className="space-y-1.5 sm:col-span-2"><Label htmlFor="profile-email">E-mail</Label><Input id="profile-email" value={user?.email ?? ""} disabled className="h-11" /></div><div className="space-y-1.5 sm:col-span-2"><Label htmlFor="profile-name">Nome completo</Label><Input id="profile-name" required maxLength={120} value={name} onChange={(event)=>setName(event.target.value)} className="h-11" /></div><div className="space-y-1.5"><Label htmlFor="profile-birth">Data de nascimento</Label><Input id="profile-birth" type="date" required max={maximumBirthDate()} value={birthDate} onChange={(event)=>setBirthDate(event.target.value)} className="h-11" /></div><div className="space-y-1.5"><Label htmlFor="profile-phone">Telefone</Label><Input id="profile-phone" type="tel" required value={phone} onChange={(event)=>setPhone(formatBrazilianPhone(event.target.value))} className="h-11" /></div><div className="sm:col-span-2"><Button disabled={saving}>{saving ? "Salvando…" : "Salvar alterações"}</Button></div></form><SecuritySettings sessionUser={user} /></>}</div>;
}