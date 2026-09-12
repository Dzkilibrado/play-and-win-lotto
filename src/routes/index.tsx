import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CheckCircle2, FileCheck2, ShieldCheck, Sparkles, UsersRound, type LucideIcon } from "lucide-react";
import { Brand } from "@/components/brand/Brand";
import { PublicFooter } from "@/components/public/PublicFooter";
import { ThemeSelector } from "@/components/layout/ThemeSelector";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app.config";
import { activeLotteries } from "@/config/lotteries";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gestor da Sorte | Jogos, bolões e resultados" },
      { name: "description", content: appConfig.description },
      { property: "og:title", content: "Gestor da Sorte | Jogos, bolões e resultados" },
      { property: "og:description", content: appConfig.description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: appConfig.canonicalOrigin },
      { property: "og:image", content: `${appConfig.canonicalOrigin}/gestor-da-sorte-social.jpg` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${appConfig.canonicalOrigin}/gestor-da-sorte-social.jpg` },
    ],
    links: [{ rel: "canonical", href: appConfig.canonicalOrigin }],
  }),
  component: LandingPage,
});

function LandingPage() {
  return <div className="min-h-screen overflow-x-hidden bg-background">
    <header className="border-b border-border bg-surface/95">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Brand />
        <div className="flex items-center gap-1.5 sm:gap-2"><ThemeSelector /><Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/login">Entrar</Link></Button><Button asChild size="sm"><Link to="/signup">Criar conta</Link></Button></div>
      </div>
    </header>
    <main>
      <section className="relative isolate min-h-[32rem] overflow-hidden bg-foreground md:min-h-[36rem]">
        <img src="/gestor-da-sorte-social.jpg" alt="Identidade visual do Gestor da Sorte com grade de dezenas" className="absolute inset-0 size-full object-cover opacity-40" fetchPriority="high" />
        <div className="absolute inset-0 bg-foreground/65" aria-hidden />
        <div className="relative mx-auto flex min-h-[32rem] max-w-6xl items-center px-4 py-16 sm:px-6 md:min-h-[36rem]">
          <div className="max-w-3xl text-primary-foreground">
            <p className="mb-4 text-sm font-semibold uppercase">Seus jogos e bolões em um só lugar</p>
            <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl md:text-6xl">Gestor da Sorte</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-primary-foreground/90 sm:text-xl">{appConfig.tagline}</p>
            <div className="mt-8 flex flex-wrap gap-3"><Button asChild size="lg" className="bg-background text-foreground hover:bg-background/90"><Link to="/signup">Começar agora</Link></Button><Button asChild size="lg" variant="outline" className="border-primary-foreground/60 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"><Link to="/login">Já tenho conta</Link></Button></div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-surface py-12" aria-labelledby="next-draws-title"><div className="mx-auto max-w-6xl px-4 sm:px-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-primary">Dados sincronizados</p><h2 id="next-draws-title" className="mt-1 font-display text-2xl font-semibold text-text-primary">Próximos sorteios</h2></div><Link to="/results" className="text-sm font-semibold text-primary hover:underline">Ver resultados</Link></div><NextDraws /></div></section>

      <section className="py-16"><div className="mx-auto max-w-6xl px-4 sm:px-6"><div className="max-w-2xl"><p className="text-sm font-semibold text-primary">Organização completa</p><h2 className="mt-2 font-display text-3xl font-semibold text-text-primary">Tudo o que importa, sem perder o controle</h2><p className="mt-3 text-text-secondary">Uma experiência clara para acompanhar apostas próprias e organizar grupos com transparência.</p></div><div className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{([
        [Sparkles,"Organize seus jogos","Crie, salve e acompanhe combinações das modalidades disponíveis."],
        [UsersRound,"Gerencie bolões","Centralize participantes, cotas, jogos e informações de pagamento."],
        [FileCheck2,"Compartilhe com transparência","Disponibilize visões controladas e comprovantes para o seu grupo."],
        [CheckCircle2,"Acompanhe resultados","Consulte concursos sincronizados e confira seus jogos organizados."],
        [BarChart3,"Explore o histórico","Use dados históricos e estatísticas como apoio de organização, nunca como promessa."],
        [ShieldCheck,"Mantenha o acesso seguro","Proteja sua conta e seus documentos com controles de acesso."],
      ] as [LucideIcon, string, string][]).map(([FeatureIcon,title,body]) => <article key={title} className="surface-card p-5"><FeatureIcon className="size-6 text-primary" aria-hidden /><h3 className="mt-4 font-display text-lg font-semibold text-text-primary">{title}</h3><p className="mt-2 text-sm leading-6 text-text-secondary">{body}</p></article>)}</div></div></section>

      <section className="border-y border-border bg-surface-secondary py-16"><div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center"><div><p className="text-sm font-semibold text-primary">Bolões organizados</p><h2 className="mt-2 font-display text-3xl font-semibold text-text-primary">Informação clara para quem organiza e participa</h2><p className="mt-4 leading-7 text-text-secondary">Registre participantes, cotas, jogos e comprovantes. Compartilhe somente a visão adequada com cada grupo e mantenha o histórico acessível.</p></div><ul className="grid gap-3 text-sm text-text-secondary">{["Participantes e cotas centralizados","Comprovantes em armazenamento privado","Links públicos controlados pelo organizador","Relatório completo gerado sob demanda"].map((item)=><li key={item} className="flex items-center gap-3"><CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />{item}</li>)}</ul></div></section>

      <section className="py-16"><div className="mx-auto max-w-6xl px-4 sm:px-6"><div className="grid gap-4 sm:grid-cols-3">{activeLotteries.map((lottery)=><article key={lottery.slug} data-lottery={lottery.colorKey} className="surface-card border-t-4 border-t-lottery p-5"><h2 className="font-display text-xl font-semibold text-text-primary">{lottery.name}</h2><p className="mt-2 text-sm text-text-secondary">Organize jogos de {lottery.selectable.min} a {lottery.selectable.max} dezenas.</p></article>)}</div><div className="mt-10 border-l-4 border-warning bg-warning-soft p-5"><h2 className="font-display text-lg font-semibold text-text-primary">Jogue com responsabilidade</h2><p className="mt-2 text-sm leading-6 text-text-secondary">O Gestor da Sorte é uma ferramenta de organização e acompanhamento. Não comercializamos apostas, não possuímos vínculo oficial com as Loterias CAIXA e não garantimos premiações. {appConfig.support.responsibleGamingNotice}</p></div></div></section>

      <section className="bg-primary py-12 text-primary-foreground"><div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center"><div><h2 className="font-display text-2xl font-semibold">Comece a organizar seus jogos e bolões</h2><p className="mt-2 text-sm text-primary-foreground/80">Crie sua conta e reúna suas informações em um só lugar.</p></div><Button asChild size="lg" className="bg-background text-foreground hover:bg-background/90"><Link to="/signup">Criar conta</Link></Button></div></section>
    </main><PublicFooter />
  </div>;
}

function NextDraws() {
  const query = useQuery({ queryKey: ["public-next-draws"], queryFn: async () => { const { data, error } = await supabase.rpc("public_next_draws"); if (error) throw error; return data ?? []; }, staleTime: 5 * 60_000 });
  if (query.isLoading) return <div className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Carregando próximos sorteios">{activeLotteries.map((item)=><div key={item.slug} className="h-28 animate-pulse rounded-md bg-surface-secondary" />)}</div>;
  const draws = query.data ?? [];
  if (query.isError || draws.length === 0) return <p className="mt-6 text-sm text-text-secondary">Os próximos sorteios estão sendo atualizados. Consulte novamente em instantes.</p>;
  return <div className="mt-6 grid gap-3 sm:grid-cols-3">{draws.map((draw)=><article key={draw.lottery_slug} data-lottery={draw.color_key} className="surface-card border-l-4 border-l-lottery p-4"><p className="font-display font-semibold text-text-primary">{draw.lottery_name}</p><p className="mt-1 text-sm text-text-secondary">Concurso {draw.next_contest_number ?? "a confirmar"}</p><p className="mt-3 text-sm font-medium text-text-primary">{draw.next_draw_date ? formatDate(draw.next_draw_date) : "Data a confirmar"}</p>{draw.estimated_next_prize ? <p className="mt-1 text-xs text-text-secondary">Estimativa {formatCurrency(draw.estimated_next_prize)}</p> : null}</article>)}</div>;
}