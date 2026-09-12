import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { Brand } from "@/components/brand/Brand";
import { ThemeSelector } from "@/components/layout/ThemeSelector";

export function AuthLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen grid-cols-[minmax(0,1fr)] bg-background lg:grid-cols-[minmax(0,1fr)_minmax(28rem,0.82fr)]">
      <section className="hidden min-w-0 border-r border-border bg-surface-secondary px-10 py-10 lg:flex lg:flex-col lg:justify-between">
        <Brand />
        <div className="max-w-xl space-y-7">
          <p className="font-display text-4xl font-semibold leading-tight text-text-primary">Organize seus jogos. Gerencie seus bolões. Acompanhe os resultados.</p>
          <ul className="space-y-3 text-sm text-text-secondary">
            {["Jogos e resultados em um só lugar", "Bolões organizados com transparência", "Dados protegidos e acesso seguro"].map((item) => <li key={item} className="flex items-center gap-3"><CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden />{item}</li>)}
          </ul>
        </div>
        <p className="max-w-xl text-xs text-text-secondary">Ferramenta de organização e acompanhamento. Não comercializamos apostas e não garantimos premiações.</p>
      </section>
      <section className="flex min-w-0 flex-col px-4 py-5 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between lg:justify-end"><Brand className="lg:hidden" /><ThemeSelector /></div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
          <div className="mb-6"><h1 className="font-display text-2xl font-semibold text-text-primary">{title}</h1><p className="mt-2 text-sm text-text-secondary">{description}</p></div>
          {children}
          <nav className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-text-secondary"><Link to="/terms" className="underline">Termos de Uso</Link><Link to="/privacy" className="underline">Política de Privacidade</Link></nav>
        </div>
      </section>
    </main>
  );
}
