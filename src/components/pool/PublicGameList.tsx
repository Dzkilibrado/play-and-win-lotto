/**
 * Lista pública dos jogos do bolão.
 * Só o essencial: número do jogo, situação, dezenas e — depois do sorteio —
 * acertos, faixa e prêmio oficial. Nenhuma métrica ou análise interna.
 */
import { useState } from "react";

import { StatusBadge } from "@/components/common/StatusBadge";
import { NumberBall } from "@/components/lottery/NumberBall";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { publicGameName, publicPreviewSize, type PublicGame } from "@/lib/pools/publicPool";
import { gameStatusLabel, gameStatusTone } from "@/types/domain";

export function PublicGameList({
  games,
  drawnNumbers,
}: {
  games: PublicGame[];
  drawnNumbers: number[];
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? games : games.slice(0, publicPreviewSize.games);
  const hidden = games.length - visible.length;
  const drawn = new Set(drawnNumbers);

  if (games.length === 0) {
    return (
      <div className="rounded-lg bg-surface-secondary px-3 py-4 text-sm">
        <p className="font-medium text-text-primary">0 jogos</p>
        <p className="mt-0.5 text-text-secondary">
          Os jogos aparecerão aqui quando forem registrados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {visible.map((game) => (
          <li key={game.ordinal} className="rounded-lg bg-surface-secondary px-3 py-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-text-primary">
                {publicGameName(game.ordinal)}
              </span>
              <StatusBadge
                label={gameStatusLabel[game.status]}
                tone={gameStatusTone[game.status]}
              />
              {game.hits !== null ? (
                <span className="text-xs text-text-secondary">
                  {game.hits} {game.hits === 1 ? "acerto" : "acertos"}
                  {game.prizeLabel ? ` · ${game.prizeLabel}` : ""}
                  {game.isPrized && game.prizeAmount !== null
                    ? ` · ${formatCurrency(game.prizeAmount)}`
                    : ""}
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {game.numbers.map((number) => (
                <NumberBall
                  key={number}
                  value={number}
                  size="sm"
                  variant={drawn.has(number) ? "hit" : "lottery"}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>

      {hidden > 0 ? (
        <Button variant="outline" className="h-11 w-full" onClick={() => setExpanded(true)}>
          Ver todos os {games.length} jogos
        </Button>
      ) : null}
    </div>
  );
}
