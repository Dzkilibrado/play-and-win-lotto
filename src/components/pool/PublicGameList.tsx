/**
 * Lista pública dos jogos do bolão.
 * Só o essencial: número do jogo, situação, dezenas e — depois do sorteio —
 * acertos, faixa e prêmio oficial. Nenhuma métrica ou análise interna.
 */
import { useState } from "react";

import { StatusBadge } from "@/components/common/StatusBadge";
import { SearchInput } from "@/components/common/SearchInput";
import { NumberBall } from "@/components/lottery/NumberBall";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { filterGames, publicGameName, publicPreviewSize, type PublicGame } from "@/lib/pools/publicPool";
import { gameStatusLabel, gameStatusTone } from "@/types/domain";

export function PublicGameList({
  games,
  drawnNumbers,
  linkedGames,
  confirmedBets,
}: {
  games: PublicGame[];
  drawnNumbers: number[];
  linkedGames: number;
  confirmedBets: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = filterGames(games, query);
  const visible = expanded || query ? filtered : filtered.slice(0, publicPreviewSize.games);
  const hidden = filtered.length - visible.length;
  const drawn = new Set(drawnNumbers);
  const plannedGames = linkedGames - confirmedBets;

  if (games.length === 0) {
    return (
      <div className="rounded-lg bg-surface-secondary px-3 py-4 text-sm">
        <p className="font-medium text-text-primary">
          Nenhum jogo vinculado
        </p>
        <p className="mt-0.5 text-text-secondary">
          Os jogos aparecerão aqui quando forem vinculados ao bolão.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {plannedGames > 0 ? (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
          {plannedGames === linkedGames
            ? "Estes jogos estão vinculados ao bolão, mas ainda não foram marcados como apostas realizadas."
            : `${plannedGames} ${plannedGames === 1 ? "jogo está vinculado" : "jogos estão vinculados"}, mas ${plannedGames === 1 ? "ainda não foi marcado" : "ainda não foram marcados"} como ${plannedGames === 1 ? "aposta realizada" : "apostas realizadas"}.`}
        </p>
      ) : null}
      {games.length > 19 ? (
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Buscar número do jogo"
          ariaLabel="Buscar jogo"
        />
      ) : null}
      {query && visible.length === 0 ? (
        <p className="px-1 py-3 text-sm text-text-secondary">Nenhum jogo encontrado.</p>
      ) : null}
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
                  // Só destacamos acerto depois da conferência oficial.
                  variant={game.hits !== null && drawn.has(number) ? "hit" : "lottery"}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>

      {hidden > 0 ? (
        <Button variant="outline" className="h-11 w-full" onClick={() => setExpanded(true)}>
          Ver todos os {filtered.length} jogos
        </Button>
      ) : null}
    </div>
  );
}
