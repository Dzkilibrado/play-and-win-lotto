import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { loadingPhrases } from "@/lib/mystic/messages";

const DURATION_MS = 6500;
const REDUCED_MOTION_MS = 1800;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Animação da leitura: barra de 0 a 100% com frases místicas. É apenas a
 * experiência — o resultado já está definido pelos dados informados.
 */
export function DestinoProgress({ onDone }: { onDone: () => void }) {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const total = prefersReducedMotion() ? REDUCED_MOTION_MS : DURATION_MS;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const ratio = Math.min((Date.now() - started) / total, 1);
      // Começa rápido e desacelera perto do fim, como uma revelação.
      setPercent(Math.round((1 - Math.pow(1 - ratio, 2)) * 100));
      if (ratio >= 1) {
        window.clearInterval(timer);
        window.setTimeout(onDone, 350);
      }
    }, 80);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const phrase = loadingPhrases[Math.min(Math.floor(percent / 21), loadingPhrases.length - 1)];

  return (
    <section
      className="surface-card mx-auto max-w-md space-y-6 p-8 text-center"
      role="status"
      aria-live="polite"
      aria-label="Gerando seus números"
    >
      <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-lottery-soft text-lottery">
        <Sparkles className="size-8 motion-safe:animate-pulse" aria-hidden />
      </span>
      <p className="font-display text-lg font-semibold text-text-primary">{phrase}</p>
      <div className="space-y-2">
        <div
          className="h-3 w-full overflow-hidden rounded-full bg-surface-secondary"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div
            className="h-full rounded-full bg-lottery transition-[width] duration-100"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="font-display text-2xl font-semibold text-lottery">{percent}%</p>
      </div>
    </section>
  );
}
