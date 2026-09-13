import { Link } from "@tanstack/react-router";
import { Brand } from "@/components/brand/Brand";
import { appConfig } from "@/config/app.config";

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-[1fr_auto]">
        <div className="min-w-0 space-y-3">
          <Brand />
          <p className="max-w-2xl text-sm text-text-secondary">O Gestor da Sorte é uma ferramenta de organização e acompanhamento. Não comercializamos apostas e não possuímos vínculo ou representação oficial das Loterias CAIXA.</p>
          <p className="text-xs text-text-secondary">Os recursos estatísticos e de geração não aumentam a probabilidade de premiação.</p>
        </div>
        <nav className="flex flex-col items-start gap-2 text-sm" aria-label="Informações legais">
          <Link to="/terms" className="touch-target inline-flex items-center text-text-secondary underline-offset-4 hover:text-text-primary hover:underline">Termos de Uso</Link>
          <Link to="/privacy" className="touch-target inline-flex items-center text-text-secondary underline-offset-4 hover:text-text-primary hover:underline">Política de Privacidade</Link>
          <span className="text-xs text-text-secondary">{appConfig.domain}</span>
        </nav>
      </div>
    </footer>
  );
}
