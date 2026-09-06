import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app.config";
import { activeLotteries } from "@/config/lotteries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${appConfig.name} — jogos, bolões e resultados` },
      { name: "description", content: appConfig.description },
      { property: "og:title", content: `${appConfig.name} — jogos, bolões e resultados` },
      { property: "og:description", content: appConfig.description },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <span className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
            {appConfig.logo.monogram}
          </span>
          <span className="font-display text-base font-semibold text-text-primary">
            {appConfig.name}
          </span>
        </span>
        <Button asChild size="sm" className="h-11">
          <Link to="/login">Entrar</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-16">
        <section className="py-10 sm:py-16">
          <h1 className="font-display text-3xl font-semibold leading-tight text-text-primary sm:text-4xl">
            {appConfig.tagline}
          </h1>
          <p className="mt-3 max-w-xl text-base text-text-secondary">{appConfig.description}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild className="h-11">
              <Link to="/login">Começar agora</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {activeLotteries.map((lottery) => (
            <article
              key={lottery.slug}
              data-lottery={lottery.colorKey}
              className="surface-card p-4"
            >
              <span className="flex size-2.5 rounded-full bg-lottery" aria-hidden />
              <h2 className="mt-2 font-display text-base font-semibold text-text-primary">
                {lottery.name}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {lottery.universe.min} a {lottery.universe.max} · {lottery.selectable.min} a{" "}
                {lottery.selectable.max} dezenas
              </p>
            </article>
          ))}
        </section>

        <p className="mt-10 text-xs text-text-secondary">
          {appConfig.support.responsibleGamingNotice}
        </p>
      </main>
    </div>
  );
}
