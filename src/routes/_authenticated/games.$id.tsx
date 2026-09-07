import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/StateViews";
import { StatusBadge } from "@/components/common/StatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { GameCard } from "@/components/lottery/GameCard";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { appConfig } from "@/config/app.config";
import { resolveRules, universeNumbers } from "@/lib/engine/rules";
import { describeFilters, generationRulesVersion, sanitizeFilterStates } from "@/lib/engine/filters";
import {
  automaticStatuses,
  gameDisplayName,
  gameStatusMeaning,
  manualStatuses,
  originLabel,
  statusWarning,
  type ContestSituation,
} from "@/lib/games/gameStatus";
import { gameService } from "@/lib/services/gameService";
import { lotteryDataService } from "@/lib/services/lotteryDataService";
import { gameStatusLabel, gameStatusTone, type GameStatus } from "@/types/domain";
import { rowAnalysis } from "@/routes/_authenticated/games.index";

export const Route = createFileRoute("/_authenticated/games/$id")({
  head: () => ({
    meta: [
      { title: `Detalhe do jogo — ${appConfig.name}` },
      { name: "description", content: "Dezenas, análise e situação de um jogo." },
      { property: "og:title", content: `Detalhe do jogo — ${appConfig.name}` },
      { property: "og:description", content: "Dezenas, análise e situação de um jogo." },
    ],
  }),
  component: GameDetailPage,
});

/** Traduz o registro interno de origem em frases simples para o usuário. */
function originFacts(notes: string | null): string[] {
  if (!notes) return [];
  const map = new Map<string, string>();
  for (const part of notes.split(";")) {
    const [key, ...rest] = part.split("=");
    if (!key || rest.length === 0) continue;
    map.set(key.trim(), rest.join("=").trim());
  }
  const facts: string[] = [];
  const price = map.get("preco");
  if (price) facts.push(`Valor da aposta informado: R$ ${Number(price).toFixed(2).replace(".", ",")}`);
  const source = map.get("fonte");
  if (source) facts.push(`Referência de preço: ${source}`);
  if (map.get("origem") === "foto") facts.push("Dezenas lidas a partir de uma foto enviada por você.");
  if (map.get("revisado_pelo_usuario") === "sim") facts.push("Você revisou e confirmou as dezenas antes de salvar.");
  return facts;
}



function GameDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const query = useQuery({
    queryKey: ["game", id],
    queryFn: () => gameService.getGame(id),
  });
  const game = query.data ?? null;

  const contest = useQuery({
    queryKey: ["game-contest", game?.lotteries?.slug, game?.contest_number],
    enabled: Boolean(game?.lotteries?.slug && game?.contest_number),
    queryFn: () => lotteryDataService.resolveContest(game!.lotteries!.slug, game!.contest_number!),
  });

  const situation: ContestSituation = game?.contest_number
    ? (contest.data?.situation ?? "unknown")
    : "unknown";

  const changeStatus = async (status: GameStatus) => {
    try {
      await gameService.updateStatus(id, status);
      await query.refetch();
      toast.success("Situação atualizada.");
    } catch {
      toast.error("Não foi possível atualizar a situação.");
    }
  };

  const removeGame = async () => {
    try {
      await gameService.deleteGame(id);
      toast.success("Jogo excluído.");
      void navigate({ to: "/games" });
    } catch {
      toast.error("Não foi possível excluir este jogo.");
    }
  };

  const canDelete = game ? !automaticStatuses.includes(game.status) : false;

  return (
    <div className="space-y-4">
      <PageHeader
        title={game ? gameDisplayName(game.sequence_number) : "Detalhe do jogo"}
        description="Dezenas, análise e situação registrada por você."
        actions={
          <Button asChild variant="outline" size="sm" className="h-11">
            <Link to="/games">Voltar</Link>
          </Button>
        }
      />

      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : null}

      {!query.isLoading && !query.isError && !game ? (
        <EmptyState
          title="Jogo não encontrado"
          description="Ele pode ter sido excluído ou pertence a outra conta."
          actions={
            <Button asChild size="sm">
              <Link to="/games">Ver meus jogos</Link>
            </Button>
          }
        />
      ) : null}

      {game ? (
        <>
          <GameCard
            title={gameDisplayName(game.sequence_number)}
            numbers={game.game_numbers.map((item) => item.number).sort((a, b) => a - b)}
            analysis={rowAnalysis(game)}
            lotteryName={resolveRules(game.lotteries?.slug)?.name ?? game.lotteries?.name ?? ""}
            colorKey={resolveRules(game.lotteries?.slug)?.colorKey ?? ""}
            contestNumber={game.contest_number}
            status={game.status}
            cost={game.cost}
            createdAt={game.created_at}
            origin={originLabel(game.source)}
            defaultExpanded
          />

          <section className="surface-card space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold text-text-primary">
                Situação do jogo
              </h2>
              <StatusBadge
                label={gameStatusLabel[game.status]}
                tone={gameStatusTone[game.status]}
              />
            </div>
            <p className="text-xs text-text-secondary">{gameStatusMeaning[game.status]}</p>

            <div className="space-y-2">
              <p className="text-xs font-medium text-text-secondary">Você pode alterar para:</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {manualStatuses.map((status) => {
                  const warning = statusWarning(status, situation);
                  const current = game.status === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => void changeStatus(status)}
                      aria-pressed={current}
                      className={`touch-target rounded-lg border p-3 text-left transition-colors ${
                        current
                          ? "border-lottery bg-lottery-soft"
                          : "border-border bg-surface hover:border-lottery"
                      }`}
                    >
                      <span className="block text-sm font-medium text-text-primary">
                        {gameStatusLabel[status]}
                      </span>
                      <span className="block text-xs text-text-secondary">
                        {gameStatusMeaning[status]}
                      </span>
                      {warning ? (
                        <span className="mt-1 block text-xs text-warning">{warning}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-text-secondary">
                Definidas automaticamente pela conferência (em desenvolvimento):
              </p>
              <div className="flex flex-wrap gap-2">
                {automaticStatuses.map((status) => (
                  <StatusBadge
                    key={status}
                    label={gameStatusLabel[status]}
                    tone={game.status === status ? gameStatusTone[status] : "neutral"}
                  />
                ))}
              </div>
            </div>
          </section>

          {originFacts(game.notes).length > 0 ? (
            <section className="surface-card space-y-2 p-4">
              <h2 className="font-display text-sm font-semibold text-text-primary">
                Como este jogo foi registrado
              </h2>
              <ul className="space-y-1 text-xs text-text-secondary">
                {originFacts(game.notes).map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <AppliedFiltersSection game={game} />

          {game.image_path ? (
            <GameDocumentSection imagePath={game.image_path} source={game.source} />
          ) : null}


          <section className="surface-card space-y-2 p-4">
            <h2 className="font-display text-sm font-semibold text-text-primary">Excluir jogo</h2>
            <p className="text-xs text-text-secondary">
              {canDelete
                ? "A exclusão é definitiva e remove as dezenas e a análise deste jogo."
                : "Jogos já conferidos não podem ser excluídos."}
            </p>
            <Button
              variant="destructive"
              disabled={!canDelete}
              onClick={() => setConfirmOpen(true)}
            >
              Excluir jogo
            </Button>
          </section>

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Excluir {gameDisplayName(game.sequence_number)}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => void removeGame()}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  );
}

/**
 * Documento do jogo: miniatura e visualização por link temporário e privado.
 * Nunca mostramos caminho de arquivo, identificadores internos ou o endereço gerado.
 */
function GameDocumentSection({ imagePath, source }: { imagePath: string; source: string }) {
  const title = source === "PHOTO_RECEIPT" ? "Comprovante da aposta" : "Canhoto importado";

  const image = useQuery({
    queryKey: ["game-image", imagePath],
    queryFn: () => gameService.getImageUrl(imagePath),
    staleTime: 4 * 60 * 1000,
  });

  return (
    <section className="surface-card space-y-3 p-4">
      <h2 className="font-display text-sm font-semibold text-text-primary">Documento do jogo</h2>
      <p className="text-xs text-text-secondary">{title}</p>

      {image.isLoading ? <LoadingState /> : null}
      {image.isError ? (
        <ErrorState
          title="Não foi possível abrir a imagem"
          description="Tente novamente em instantes."
          onRetry={() => void image.refetch()}
        />
      ) : null}

      {image.data ? (
        <>
          <img
            src={image.data}
            alt={title}
            className="max-h-56 w-full rounded-lg border border-border object-contain"
          />
          <Button asChild variant="outline" size="sm" className="h-11">
            <a href={image.data} target="_blank" rel="noreferrer">
              Visualizar imagem
            </a>
          </Button>
          <p className="text-xs text-text-secondary">
            A imagem fica guardada em área privada e só você tem acesso.
          </p>
        </>
      ) : null}
    </section>
  );
}

/**
 * Filtros usados quando o jogo foi criado. O registro é um retrato do momento:
 * mudanças posteriores nas regras não alteram o que já foi salvo.
 */
function AppliedFiltersSection({
  game,
}: {
  game: {
    generation_constraints: unknown;
    game_numbers: { number: number }[];
    lotteries?: { slug?: string | null } | null;
  };
}) {
  const rules = resolveRules(game.lotteries?.slug ?? null);
  const raw = game.generation_constraints as { filters?: unknown; version?: unknown } | null;
  if (!rules || !raw || typeof raw !== "object" || !raw.filters) return null;

  const numbers = game.game_numbers.map((item) => item.number);
  const states = sanitizeFilterStates(raw.filters);
  // A regra de saltos mudou de significado na versão 2. Jogos salvos com a
  // regra antiga não são reinterpretados: o filtro fica de fora da lista.
  const legacyRules = (typeof raw.version === "number" ? raw.version : 1) < generationRulesVersion;
  if (legacyRules) states.gapRun = { enabled: false, config: { max: null } };
  const chips = describeFilters(states, {
    rules,
    numbersCount: numbers.length,
    fixed: [],
    pool: universeNumbers(rules),
    excluded: [],
    previousDraw: null,
  });
  if (!chips.length) return null;

  return (
    <section className="surface-card space-y-2 p-4">
      <h2 className="font-display text-sm font-semibold text-text-primary">
        Filtros usados na criação
      </h2>
      <ul className="space-y-1 text-xs text-text-secondary">
        {chips.map((chip) => (
          <li key={chip.id}>{chip.summary}</li>
        ))}
      </ul>
      {legacyRules ? (
        <p className="text-xs text-text-secondary">
          Este jogo foi criado com uma versão anterior do filtro de saltos, por isso esse item não
          é exibido aqui.
        </p>
      ) : null}
      <p className="text-xs text-text-secondary">
        Filtros organizam a escolha das dezenas e não aumentam a chance de premiação.
      </p>
    </section>
  );
}
