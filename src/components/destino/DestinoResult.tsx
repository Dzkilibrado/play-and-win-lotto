import { Sparkles } from "lucide-react";

import { GameCard } from "@/components/lottery/GameCard";
import { GameSecondaryLine } from "@/components/lottery/GameSecondaryLine";
import { type LotteryConfig } from "@/config/lotteries";
import { analyzeGame } from "@/lib/engine/analyzer";
import { resolveRules } from "@/lib/engine/rules";
import type { MysticGame } from "@/lib/mystic/generator";
import { mysticDisclaimer } from "@/lib/mystic/messages";

/** Mensagem mística, os jogos e o aviso de responsabilidade (sempre presente). */
export function DestinoResult({
  lottery,
  lotteryId,
  games,
  phrase,
  unitPrice,
  contestNumber,
}: {
  lottery: LotteryConfig;
  lotteryId: string | undefined;
  games: MysticGame[];
  phrase: string;
  unitPrice: number | null;
  contestNumber: number | null;
}) {
  const rules = resolveRules(lottery.slug);
  return (
    <section className="space-y-4" aria-labelledby="destino-resultado">
      <div className="surface-card space-y-1 bg-lottery-soft p-5 text-center">
        <Sparkles className="mx-auto size-6 text-lottery" aria-hidden />
        <h2 id="destino-resultado" className="font-display text-lg font-semibold text-text-primary">
          {phrase}
        </h2>
        <p className="text-sm text-text-secondary">Seus números de {lottery.name}</p>
      </div>

      <div className="space-y-3">
        {games.map((game, index) => (
          <div key={game.numbers.join("-")} className="space-y-2">
            <GameCard
              title={`Jogo ${index + 1}`}
              numbers={game.numbers}
              analysis={analyzeGame(game.numbers, rules!)}
              lotteryName={lottery.name}
              colorKey={lottery.colorKey}
              cost={unitPrice}
              contestNumber={contestNumber}
            />
            <GameSecondaryLine
              slug={lottery.slug}
              lotteryId={lotteryId}
              selection={game.secondary}
            />
          </div>
        ))}
      </div>

      <p className="rounded-lg bg-surface-secondary p-3 text-xs text-text-secondary" role="note">
        {mysticDisclaimer}
      </p>
    </section>
  );
}
